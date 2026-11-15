"""Exact licensed OCR assets used by reviewed local hosts and exports."""
import hashlib
from pathlib import Path

VENDOR = {
    'bos.traineddata.gz': (1146143, '91bd93692051c8a6c33f21117ca1687cf93a759825f255e5821178189f214855'),
    'eng.traineddata.gz': (1967599, 'f1c22599ed6fd3eb821d87fdb43e09f98b61179a4abe38c43cfca2cdcb9f5ec2'),
    'notice-bmp-js-LICENSE.txt': (1077, '9f165f5bd2b462122cacb8c6dc32028be1abb4d8ad0322e9a332f30b2ebdb833'),
    'notice-buffer-LICENSE.txt': (1106, '06bafa45fdad2579ba0e43b0c9b2c6290287c99c4203c300254a462b38a307f6'),
    'notice-giflib-LICENSE.txt': (1088, '0c9b7990ecdca88b676db232c226548ac408b279f550d424d996f0d83591dd8e'),
    'notice-idb-keyval-LICENSE.txt': (555, '20c27d6339619eeb3113cb865d4e98a3f559e52964fc75caea9cb5fa72674565'),
    'notice-ieee754-LICENSE.txt': (1465, '18d45466ba3253deae04667e267a91ea8de8548f18c1125264d1c9db28194cc1'),
    'notice-leptonica-LICENSE.txt': (1521, '87829abb5bbb00b55a107365da89e9a33f86c4250169e5a1e5588505be7d5806'),
    'notice-libjpeg-LICENSE.txt': (19110, 'c791da525733040e622ed257c7b096b8f5191b332604ead0c6bc2b54cbd8e0d1'),
    'notice-libpng-LICENSE.txt': (5345, '33ba4e187d8b0c8d7ab2bc2e522bb095219e03089e9aa0122b4fb9eb2b7de82b'),
    'notice-libtiff-LICENSE.txt': (1146, 'fbd6fed7938541d2c809c0826225fc85e551fdbfa8732b10f0c87e0847acafd7'),
    'notice-libwebp-LICENSE.txt': (1496, '5aec868f669e384a22372a4e8a1a6cd7d44c64cd451f960ca69cc170d1e13acf'),
    'notice-openlibm-LICENSE.txt': (5857, 'b1843fbf5b03f519a5f0a44fce751bdd1022ae7148614923f9d6293e17a18b17'),
    'notice-regenerator-runtime-LICENSE.txt': (1080, '51887a3d47051ac2fce1210562e5b9fe0830a8a8fabeb272c2d586eeb18a05fd'),
    'notice-tesseract-LICENSE.txt': (11358, 'cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30'),
    'notice-wasm-feature-detect-LICENSE.txt': (11542, '45286bffeeb04f5707bb3cd7e079bf7f0db91d17596fb7401736e03e516500cf'),
    'notice-zlib-LICENSE.txt': (5368, 'fc2c3368901700f0acdeb1d8afeaca5923296768ec6824ecdf627aac396001fd'),
    'notice-zlibjs-LICENSE.txt': (1222, '131afe3f7bdce1698beb292fb8de1a968de01bce876122a60ef5db230471c866'),
    'tessdata-LICENSE': (11358, 'cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30'),
    'tesseract-core-lstm.wasm.js': (3954181, '775a35df6f2ae100e02609443e6bd5cafcd07983dd6175454ca4a432a7730687'),
    'tesseract.js-LICENSE.md': (11357, 'b40930bbcf80744c86c46a12bc9da056641d722716c378f5659b9e555ef833e1'),
    'tesseract.js-core-LICENSE': (11358, 'c6596eb7be8581c18be736c846fb9173b69eccf6ef94c5135893ec56bd92ba08'),
    'tesseract.min.js': (62961, '10fff78484067759c43028a02a72d76d0b90eb17302bb23b58a9ec5410bc928b'),
    'tesseract.min.js.LICENSE.txt': (149, 'cdf963ced7d25a0f98901a547647b4d6e2dbe0197fd78c87a059a87b0e542fe2'),
    'worker.min.js': (111162, '38645599043239c0eb6db08a6504a92dcdc292200535f3e9339cd77c4443b842'),
    'worker.min.js.LICENSE.txt': (466, '45f54171aeaa1d10c0c1a66f374b7bba1f02472b1487fbe892eec04f840002ac'),
}

def files(sense):
    sense=Path(sense); result={}
    for name,(size,digest) in VENDOR.items():
        path=sense/"vendor/ocr"/name
        if path.is_symlink() or not path.is_file() or path.stat().st_size!=size:raise ValueError("Missing or changed pinned OCR asset: "+name)
        data=path.read_bytes()
        if hashlib.sha256(data).hexdigest()!=digest:raise ValueError("Changed pinned OCR asset: "+name)
        result["sense/vendor/ocr/"+name]=data
    # Provenance is metadata, not executable loader configuration.
    path=sense/"vendor/ocr/provenance.json"
    if path.is_symlink() or not path.is_file() or path.stat().st_size>50000:raise ValueError("Invalid OCR provenance.")
    result["sense/vendor/ocr/provenance.json"]=path.read_bytes()
    return result
