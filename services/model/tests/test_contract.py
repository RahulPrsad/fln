import json
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.main import health, infer


class ModelContractTest(unittest.TestCase):
    def test_health_payload(self):
        payload = health()
        self.assertEqual(payload["service"], "smartfln-model")
        self.assertEqual(payload["status"], "ok")

    def test_infer_returns_review_safe_result(self):
        sample_path = ROOT / "app" / "contracts" / "sample_request.json"
        payload = json.loads(sample_path.read_text(encoding="utf-8"))
        result = infer(payload)
        self.assertEqual(result["scanPageId"], "sp_demo")
        self.assertEqual(len(result["results"]), 1)
        self.assertEqual(result["results"][0]["questionId"], "q_demo_2")
        self.assertLess(result["results"][0]["confidence"], 0.5)
        self.assertEqual(result["results"][0]["needsReview"], True)


if __name__ == "__main__":
    unittest.main()
