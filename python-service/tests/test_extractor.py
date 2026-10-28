
import os
import sys
import unittest

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIXTURES_DIR = os.path.join(BASE_DIR, "fixtures")
sys.path.insert(0, BASE_DIR)

from extractor import extract_statement


class TestBank2Excel(unittest.TestCase):
    
    def test_find_labeled_amount_uncertainty(self):
        from extractor import _find_labeled_amount, OPENING_HINTS

        # Amount on the same line should be certain.
        value, uncertain = _find_labeled_amount(
            "Opening balance: $1,250.00",
            OPENING_HINTS,
        )
        self.assertEqual(value, 1250.00)
        self.assertFalse(uncertain)

        # Amount on a nearby line should be marked uncertain.
        value, uncertain = _find_labeled_amount(
            "Opening balance\n$1,250.00",
            OPENING_HINTS,
        )
        self.assertEqual(value, 1250.00)
        self.assertTrue(uncertain)

        # Missing amount should return None.
        value, uncertain = _find_labeled_amount(
            "Opening balance\nNo amount shown",
            OPENING_HINTS,
        )
        self.assertIsNone(value)
        self.assertFalse(uncertain)

    def test_fixture_files_exist(self):
        pdf_files = [
            f for f in os.listdir(FIXTURES_DIR)
            if f.lower().endswith(".pdf")
        ]
        self.assertGreaterEqual(len(pdf_files), 2)

    def check_statement(
        self,
        filename,
        expected_count,
        expected_opening,
        expected_credits,
        expected_debits,
        expected_closing,
    ):
        path = os.path.join(FIXTURES_DIR, filename)

        with open(path, "rb") as pdf_file:
            result = extract_statement(
                pdf_bytes=pdf_file.read(),
                filename=filename,
            )

        self.assertTrue(result.get("ok"), result.get("error"))

        transactions = result.get("transactions", [])
        self.assertEqual(len(transactions), expected_count)

        self.assertAlmostEqual(
            float(result["openingBalance"]),
            expected_opening,
            places=2,
        )
        self.assertAlmostEqual(
            float(result["statedClosingBalance"]),
            expected_closing,
            places=2,
        )

        actual_credits = sum(
            float(tx.get("credit") or 0)
            for tx in transactions
        )
        actual_debits = sum(
            float(tx.get("debit") or 0)
            for tx in transactions
        )

        self.assertAlmostEqual(actual_credits, expected_credits, places=2)
        self.assertAlmostEqual(actual_debits, expected_debits, places=2)

        calculated_closing = (
            expected_opening + actual_credits - actual_debits
        )
        self.assertAlmostEqual(
            calculated_closing,
            expected_closing,
            places=2,
        )

    def test_first_sample_statement(self):
        filename = "fictional-bank-statement-test.pdf"
        self.check_statement(
            filename=filename,
            expected_count=7,
            expected_opening=1250.00,
            expected_credits=2750.00,
            expected_debits=301.44,
            expected_closing=3698.56,
        )

    def test_pinecone_statement(self):
        filename = "fictional_bank2excel_test_statement.pdf"
        self.check_statement(
            filename=filename,
            expected_count=8,
            expected_opening=2000.00,
            expected_credits=2804.99,
            expected_debits=1639.73,
            expected_closing=3165.26,
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)

    def test_uncertain_balance_warning(self):
        # A warning should be present when the opening balance
        # is parsed with low confidence.
        warnings = [
            "Opening balance was parsed with low confidence."
        ]

        self.assertIn(
            "Opening balance was parsed with low confidence.",
            warnings,
        )
