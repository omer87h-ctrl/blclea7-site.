"""Exercise verification control flow with fixture bytes; real HTTPS is a separate job."""
import hashlib,io,unittest,urllib.error
from unittest.mock import patch
from scripts import check_live as p
class Response(io.BytesIO):
 status=200
 url='https://release-assets.githubusercontent.com/github-production-release-asset/fixture'
class LiveVerificationTests(unittest.TestCase):
 def test_only_actual_api_rate_limits_enable_full_binary_fallback(self):
  for code,headers,body in [(403,{'X-RateLimit-Remaining':'0'},b''),(403,{},b'API rate limit exceeded'),(429,{},b'')]:
   with patch.object(p.urllib.request,'urlopen',side_effect=urllib.error.HTTPError('https://api.github.com',code,'limited',headers,io.BytesIO(body))):
    self.assertIsNone(p.fetch_release_metadata())
  for code in [401,403,404,500]:
   with patch.object(p.urllib.request,'urlopen',side_effect=urllib.error.HTTPError('https://api.github.com',code,'not limited',{},io.BytesIO(b'forbidden'))):
    with self.assertRaises(urllib.error.HTTPError):p.fetch_release_metadata()
 def test_full_binary_download_verifies_bytes_and_hash_without_credentials(self):
  data=b'MZ'+b'fixture-only-not-an-executable'*20
  item={'key':'installer','size_bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
  def opened(request,timeout):
   self.assertFalse(request.has_header('Authorization'));self.assertFalse(request.has_header('Range'));return Response(data)
  with patch.object(p.urllib.request,'urlopen',side_effect=opened):
   result=p.anonymous_full_download(item,'https://github.com/exact/approved.exe')
   self.assertTrue(result['anonymousDownloadSha256Verified']);self.assertIsNone(result['releaseDigestMatches'])
  for bad in [data+b'x',data[:-1],b'x'*len(data)]:
   with patch.object(p.urllib.request,'urlopen',return_value=Response(bad)):
    with self.assertRaises(AssertionError):p.anonymous_full_download(item,'https://github.com/exact/approved.exe')
