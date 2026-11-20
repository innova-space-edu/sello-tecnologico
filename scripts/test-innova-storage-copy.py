import importlib.util, io, tempfile, sys, types
from pathlib import Path
spec = importlib.util.spec_from_file_location("migration", Path(__file__).with_name("innova-storage-copy.py"))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
class ClientError(Exception):
    def __init__(self, code):
        self.response = {"Error":{"Code":code}}
exceptions = types.ModuleType("botocore.exceptions")
exceptions.ClientError = ClientError
sys.modules["botocore.exceptions"] = exceptions
payload = b"mock evidence content"
class Source:
    def get_object(self, **kwargs):
        assert kwargs["IfMatch"] == "v1"
        return {"Body":io.BytesIO(payload),"ContentLength":len(payload),"ContentType":"application/pdf"}
class Target:
    def __init__(self):
        self.data = None
        self.writes = 0
    def head_object(self, **kwargs):
        if self.data is None:
            raise ClientError("404")
        return {"ContentType":"application/pdf"}
    def upload_file(self, path, bucket, key, ExtraArgs):
        assert bucket == m.TARGET_BUCKET and key == "evidencias/example.pdf"
        self.data = Path(path).read_bytes()
        self.writes += 1
    def get_object(self, **kwargs):
        return {"Body":io.BytesIO(self.data)}
with tempfile.TemporaryDirectory() as folder:
    obj = {"Key":"example.pdf","Size":len(payload),"ETag":"v1"}
    target = Target()
    result = m.copy_one(Source(),target,obj,Path(folder))
    assert result["verified"] and result["bytes"] == len(payload)
    assert (Path(folder)/result["backup_file"]).read_bytes() == payload
    m.copy_one(Source(),target,obj,Path(folder))
    assert target.writes == 1
    target.data = b"corrupt"
    try:
        m.copy_one(Source(),target,obj,Path(folder))
    except RuntimeError:
        pass
    else:
        raise AssertionError("corruption accepted")
    assert target.writes == 1
print("PASS: copy, backup, SHA-256, idempotence, reject corrupt destination")
