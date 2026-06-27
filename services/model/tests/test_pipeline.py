import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from PIL import Image, ImageDraw

from app.pipeline.evaluator import infer_full_scan
from app.pipeline.preprocess import image_to_data_url
from app.pipeline.scoring import compare_answer, score_answer
from app.pipeline.vision import parse_qr_payload


class PipelineTest(unittest.TestCase):
    def test_parse_json_qr_payload(self):
        payload = parse_qr_payload('{"student_id":"stu_1","paper_id":"paper_1","test_id":"test_1"}')
        self.assertEqual(payload["student_id"], "stu_1")
        self.assertEqual(payload["paper_id"], "paper_1")
        self.assertEqual(payload["test_id"], "test_1")

    def test_parse_existing_smartfln_short_qr(self):
        payload = parse_qr_payload("SFLN:pp_abc123:deadbeef")
        self.assertEqual(payload["paper_id"], "pp_abc123")
        self.assertEqual(payload["paper_page_id"], "pp_abc123")

    def test_score_numeric_exact_answer(self):
        question = {"type": "numeric", "answer_key": "5", "marks": 1, "auto_score": True}
        result = score_answer(question, "5", 0.94, 0.9)
        self.assertEqual(result["awardedMarks"], 1)
        self.assertEqual(result["needsReview"], False)

    def test_compare_short_text_similarity(self):
        question = {"type": "short_text", "answer_key": "circle"}
        result = compare_answer(question, "circl")
        self.assertGreater(result["matchScore"], 0.85)

    def test_full_scan_returns_review_safe_json(self):
        image = Image.new("RGB", (700, 990), "white")
        draw = ImageDraw.Draw(image)
        draw.rectangle((50, 210, 650, 310), outline="black", width=3)
        draw.text((60, 220), "5", fill="black")

        request = {
            "scanPageId": "scan_test_1",
            "qrText": '{"student_id":"stu_1","paper_id":"paper_inline","test_id":"test_1"}',
            "imageDataUrl": image_to_data_url(image),
            "template": {
                "paper_id": "paper_inline",
                "test_id": "test_1",
                "page": {"width": 700, "height": 990},
                "questions": [
                    {
                        "question_id": "q1",
                        "label": "Q1",
                        "type": "numeric",
                        "answer_key": "5",
                        "marks": 1,
                        "roi": {"x": 50, "y": 210, "width": 600, "height": 100},
                    }
                ],
            },
        }

        result = infer_full_scan(request)
        self.assertEqual(result["scan_id"], "scan_test_1")
        self.assertEqual(result["student_id"], "stu_1")
        self.assertEqual(result["paper_id"], "paper_inline")
        self.assertEqual(len(result["answers"]), 1)
        self.assertEqual(result["answers"][0]["needs_teacher_review"], True)
        self.assertIn("answer_rois_cropped", result["pipeline"])


if __name__ == "__main__":
    unittest.main()
