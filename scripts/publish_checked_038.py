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

def main():
 if (os.environ.get('GITHUB_REPOSITORY')!=REPO or os.environ.get('GITHUB_ACTOR')!='omer87h-ctrl' or os.environ.get('GITHUB_EVENT_NAME')!='workflow_dispatch'):
  raise ValueError('Explicit owner release dispatch required.')
 root=Path(__file__).resolve().parents[1]
 receipt=json.loads((root/'release/windows-installed-038.json').read_text())
 if (receipt.get('passed') is not True or receipt.get('installerSource')!=SOURCE or receipt.get('installerSha256')!=INSTALLER_SHA
     or not all(receipt.get(k) is True for k in ('actualInstallerExecuted','actualUninstallerExecuted','userFilesPreserved'))):raise ValueError('Actual installation/uninstallation proof is required.')
 value=validate_url(os.environ.get('CLEA_APPROVED_TRANSFER_URL',''))
 with tempfile.TemporaryDirectory(prefix='clea-approved-038-') as folder:
  folder=Path(folder);archive=folder/'approved.zip'
  download(value,archive,archive_bytes=ARCHIVE_BYTES,archive_sha=ARCHIVE_SHA)
  installer=unpack(archive,folder,archive_bytes=ARCHIVE_BYTES,archive_sha=ARCHIVE_SHA,installer_bytes=INSTALLER_BYTES,installer_sha=INSTALLER_SHA)
  sums=folder/'SHA256SUMS.txt';sums.write_text(INSTALLER_SHA+'  '+INSTALLER+'\n')
  provenance=folder/'provenance.json';provenance.write_text(json.dumps({'format':'clea7.checked-public-binaries/1','version':'0.38.0-test','windows':{'buildRun':BUILD_RUN,'source':SOURCE,'bytes':INSTALLER_BYTES,'sha256':INSTALLER_SHA,'installedManifestVerified':receipt['installedManifestVerified'],'actualInstallAndUninstall':True},'productionSigned':False,'containsModel':False,'containsPrivateProjectSource':False,'physicalAssistiveEvaluation':False},indent=2)+'\n')
  subprocess.run(['gh','release','create',TAG,str(installer),str(sums),str(provenance),'--repo',REPO,'--target',os.environ['GITHUB_SHA'],'--prerelease','--title','BL CLEA7 Windows0.38 — checked Studio, Runtime and installer','--notes-file',str(root/'release/038-WINDOWS-NOTES.md')],check=True)
 print('Published only the exact checked Windows development installer.')

if __name__=='__main__':
 try:main()
 except Exception as error:
  print('Approved publication failed: '+type(error).__name__);raise SystemExit(1)
