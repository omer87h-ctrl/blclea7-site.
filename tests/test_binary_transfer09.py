"""Security boundaries and integrity gates for owner-approved release promotion."""
import hashlib, importlib.util, io, json, tempfile, unittest, zipfile
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('promotion09', Path(__file__).resolve().parents[1]/'scripts/promote_approved_binaries09.py')
p = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)
URL = 'https://sdmntprdenmarkeast.oaiusercontent.com/files/approved-copy?sig=temporary'

def event():
    return {'action':'opened','repository':{'full_name':p.TARGET},'sender':{'login':p.OWNER},
            'issue':{'number':3,'user':{'login':p.OWNER},'title':p.TITLE,'body':json.dumps({
                'format':'clea7.binary-transfer/1','source_commit':p.COMMIT,
                'assets':{key:{'url':URL} for key in p.ARTIFACTS}})}}

class Response(io.BytesIO):
    status = 200

class Download:
    def __init__(self, data): self.data=data
    def open(self, request, timeout):
        assert not request.has_header('Authorization')
        return Response(self.data)

def zipped(entries):
    data=io.BytesIO()
    with zipfile.ZipFile(data,'w') as archive:
        for name,value in entries: archive.writestr(name,value)
    return data.getvalue()

class TransferTests(unittest.TestCase):
    def test_exact_owner_and_commit_only(self):
        self.assertEqual(set(p.descriptor(event())['assets']),set(p.ARTIFACTS))
        for key,value in [('action','edited'),('sender',{'login':'someone'}),('repository',{'full_name':'other/repo'})]:
            item=event();item[key]=value
            with self.assertRaises(p.ReleaseError):p.descriptor(item)
        item=event();item['issue']['user']['login']='someone'
        with self.assertRaises(p.ReleaseError):p.descriptor(item)
        for edit in [lambda b:b.update(source_commit='wrong'),lambda b:b['assets'].pop('studio'),lambda b:b['assets'].update(extra={'url':URL}),lambda b:b['assets']['studio'].update(token='secret')]:
            item=event();body=json.loads(item['issue']['body']);edit(body);item['issue']['body']=json.dumps(body)
            with self.assertRaises(p.ReleaseError):p.descriptor(item)

    def test_transfer_and_authenticated_host_boundaries(self):
        self.assertEqual(p.transfer_url(URL),URL)
        for url in ['http://sdmntprdenmarkeast.oaiusercontent.com/files/x',
                    'https://oaiusercontent.com.evil.example/files/x','https://localhost/files/x',
                    'https://user:secret@sdmntprdenmarkeast.oaiusercontent.com/files/x',
                    'https://sdmntprdenmarkeast.oaiusercontent.com:444/files/x',
                    'https://sdmntprdenmarkeast.oaiusercontent.com/not-a-file',URL+'#fragment']:
            with self.assertRaises(p.ReleaseError):p.transfer_url(url)
        with self.assertRaises(p.ReleaseError):p.valid_url(URL)
        with self.assertRaises(p.ReleaseError):p.valid_url('https://evil.example/upload',upload=True)

    def test_streamed_byte_limit_and_digest(self):
        data=b'approved binary';expected={'size':len(data),'sha256':hashlib.sha256(data).hexdigest()}
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'copy'
            p.copy_verified(URL,expected,path,Download(data));self.assertEqual(path.read_bytes(),data)
            for wrong in [data+b'X',data[:-1],b'X'*len(data)]:
                with self.assertRaises(p.ReleaseError):p.copy_verified(URL,expected,path,Download(wrong))

    def test_extracts_only_one_structural_apk(self):
        apk=zipped([('AndroidManifest.xml',b'manifest'),('classes.dex',b'dex')])
        self.assertEqual(p.clean_apk(zipped([('runtime.apk',apk),('ci-log.txt',b'not published')])),apk)
        for entries in [[('../runtime.apk',apk)],[('a.apk',apk),('b.apk',apk)],[('runtime.apk',zipped([('missing',b'dex')]))]]:
            with self.assertRaises(p.ReleaseError):p.clean_apk(zipped(entries))

    def test_existing_assets_are_idempotent_and_never_overwritten(self):
        data=b'original';item={'name':'test.zip','size':len(data),'digest':'sha256:'+hashlib.sha256(data).hexdigest()}
        release={'assets':[item]}
        with patch.object(p,'api',side_effect=AssertionError('must not upload')):
            self.assertEqual(p.publish_asset(release,'test.zip',data,'not-a-real-token'),item)
            with self.assertRaises(p.ReleaseError):p.publish_asset(release,'test.zip',b'changed','not-a-real-token')

    def test_pinned_public_output_identity(self):
        for key,item in p.ARTIFACTS.items():
            record=p.asset_record(key,item['output'],b'x')
            self.assertTrue(record['url'].startswith('https://github.com/'+p.TARGET+'/releases/download/'+p.TAG+'/'))
            self.assertEqual(len(item['sha256']),64)
            self.assertGreater(item['size'],0)

if __name__ == '__main__': unittest.main()
