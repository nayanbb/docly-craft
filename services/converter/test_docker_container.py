import urllib.request

boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
body = (
    f'--{boundary}\r\n'
    f'Content-Disposition: form-data; name="operation"\r\n\r\n'
    f'word-to-pdf\r\n'
    f'--{boundary}\r\n'
    f'Content-Disposition: form-data; name="file"; filename="sample.docx"\r\n'
    f'Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document\r\n\r\n'
).encode() + open('test-fixtures/sample.docx', 'rb').read() + f'\r\n--{boundary}--\r\n'.encode()

req = urllib.request.Request(
    'http://localhost:8002/convert',
    data=body,
    headers={'Content-Type': f'multipart/form-data; boundary={boundary}'}
)

with urllib.request.urlopen(req) as res:
    content = res.read()
    print("SUCCESS: Converted via Linux Docker LibreOffice!")
    print("Status:", res.getcode())
    print("PDF Output size:", len(content), "bytes")
    print("Header:", content[:5])
