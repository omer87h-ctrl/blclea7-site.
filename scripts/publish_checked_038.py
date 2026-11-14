"""Promote only the exact checked current Windows test installer. No model/source."""
import json,os,subprocess,tempfile
from pathlib import Path
from .publish_checked_037 import REPO,INSTALLER,validate_url,download,unpack,verify

TAG='clea7-windows-0.38.0-test'
SOURCE='e274a756db0f367684fde2fe2bb61840a3bf8f27'
BUILD_RUN=42534855702
ARCHIVE_BYTES=249199952
ARCHIVE_SHA='92591a71d3cac9d06cb3d773749b35157ccff53af87eb1ee5d2c92bd7582572d'
INSTALLER_BYTES=249142364
INSTALLER_SHA='86634ddb6fa92b23eef0f5a5d7237a62d4f0595e66a1d24357e38b657d60d006'

def release_spec(variant='initial'):
 if variant=='initial':
  return dict(tag=TAG,source=SOURCE,build_run=BUILD_RUN,archive_bytes=ARCHIVE_BYTES,archive_sha=ARCHIVE_SHA,installer_bytes=INSTALLER_BYTES,installer_sha=INSTALLER_SHA,receipt='windows-installed-038.json',notes='038-WINDOWS-NOTES.md',title='BL CLEA7 Windows0.38 — checked Studio, Runtime and installer')
 if variant=='single-ai':
  return dict(tag='clea7-windows-0.38-single-ai-test',source='0491ab804260c801a793b691a49eaba73e76ce3e',build_run=42562785101,archive_bytes=249267447,archive_sha='4d8155aa7eb4cfeec8020b7f7c08423b837e99cc0a67dfcad20d10647e6a1108',installer_bytes=249209930,installer_sha='f0c11f6c8af05e843a38b280c385fa845568c013382b77151c30e35a813d5408',receipt='windows-installed-single-ai-038.json',notes='038-SINGLE-AI-WINDOWS-NOTES.md',title='BL CLEA7 Windows0.38 — one AI workspace, Studio and Runtime')
 if variant=='integrated-039':
  return dict(version='0.39.0-test',tag='clea7-windows-0.39-test',source='9092f01f2034454f692c634066f9ed0bd39d0de9',build_run=42667011893,archive_bytes=249783922,archive_sha='fa891cd14b7b0099ef50a73a9586dd83c97e36c59196b2a88f41434acb7fa91c',installer_bytes=249726161,installer_sha='d181418bf3551eca54b57d5786822b4d75eb522c77041101bcc55f58f4242393',receipt='windows-installed-working-039.json',notes='039-WINDOWS-NOTES.md',title='BL CLEA7 Windows0.39 — connected visual elements, Studio and Runtime')
 if variant=='draw-040':
  return dict(version='0.40.0-test',tag='clea7-windows-0.40-test',source='980ae86a15fe1ddbb4ec8442fb5bfe4d1f5b9610',build_run=43598140076,archive_bytes=249827535,archive_sha='53ceec13fa0d46eccec6aa3fd2cec7950699d0dea3e958f71d59dde2c1b64d11',installer_bytes=249769336,installer_sha='486a3abeed9fc0a8f3a044942a54b3c493901ed17b975bfab82faea191fcebd7',receipt='windows-installed-cards-040.json',notes='040-WINDOWS-NOTES.md',title='BL CLEA7 Windows0.40 — functional Draw, typed collections and shared Runtime')
 raise ValueError('Unknown checked release variant.')

def install_receipt(root,spec):
 receipt=json.loads((root/'release'/spec['receipt']).read_text())
 if (receipt.get('passed') is not True or receipt.get('installerSource')!=spec['source'] or receipt.get('installerSha256')!=spec['installer_sha']
     or receipt.get('installedManifestVerified',{}).get('verified') is not True
     or not all(receipt.get(k) is True for k in ('actualInstallerExecuted','actualUninstallerExecuted','userFilesPreserved'))):raise ValueError('Actual matching installation/uninstallation proof is required.')
 return receipt

def main():
 if (os.environ.get('GITHUB_REPOSITORY')!=REPO or os.environ.get('GITHUB_ACTOR')!='omer87h-ctrl' or os.environ.get('GITHUB_EVENT_NAME')!='workflow_dispatch'):
  raise ValueError('Explicit owner release dispatch required.')
 root=Path(__file__).resolve().parents[1]
 spec=release_spec(os.environ.get('CLEA_CHECKED_VARIANT','initial'))
 receipt=install_receipt(root,spec)
 value=validate_url(os.environ.get('CLEA_APPROVED_TRANSFER_URL',''))
 with tempfile.TemporaryDirectory(prefix='clea-approved-038-') as folder:
  folder=Path(folder);archive=folder/'approved.zip'
  download(value,archive,archive_bytes=spec['archive_bytes'],archive_sha=spec['archive_sha'])
  installer=unpack(archive,folder,archive_bytes=spec['archive_bytes'],archive_sha=spec['archive_sha'],installer_bytes=spec['installer_bytes'],installer_sha=spec['installer_sha'])
  sums=folder/'SHA256SUMS.txt';sums.write_text(spec['installer_sha']+'  '+INSTALLER+'\n')
  provenance=folder/'provenance.json';provenance.write_text(json.dumps({'format':'clea7.checked-public-binaries/1','version':spec.get('version','0.38.0-test'),'variant':os.environ.get('CLEA_CHECKED_VARIANT','initial'),'windows':{'buildRun':spec['build_run'],'installationRun':receipt['verificationRun'],'source':spec['source'],'bytes':spec['installer_bytes'],'sha256':spec['installer_sha'],'installedManifestVerified':receipt['installedManifestVerified'],'actualInstallAndUninstall':True},'productionSigned':False,'containsModel':False,'containsPrivateProjectSource':False,'physicalAssistiveEvaluation':False},indent=2)+'\n')
  subprocess.run(['gh','release','create',spec['tag'],str(installer),str(sums),str(provenance),'--repo',REPO,'--target',os.environ['GITHUB_SHA'],'--prerelease','--title',spec['title'],'--notes-file',str(root/'release'/spec['notes'])],check=True)
 print('Published only the exact checked Windows development installer.')

if __name__=='__main__':
 try:main()
 except Exception as error:
  print('Approved publication failed: '+type(error).__name__);raise SystemExit(1)
