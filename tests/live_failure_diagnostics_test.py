"""Run the verifier's actual guarded browser block with deterministic test doubles.

No browser launch, network request, installation or gameplay execution occurs.
"""
import ast
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


def exercise(path, initial_error=None, capture_errors=()):
    source = path.read_text()
    tree = ast.parse(source)
    block = next(node for node in ast.walk(tree) if isinstance(node, ast.Try)
                 and any(isinstance(n, ast.Assign) and
                         "report['status']" in ast.unparse(n)
                         for n in node.body))
    code = compile(ast.Module(body=[block], type_ignores=[]), str(path), 'exec')

    class Page:
        def __init__(self):
            self.captures = []
            self.views = []

        def goto(self, *args, **kwargs):
            pass

        def wait_for_function(self, *args, **kwargs):
            if initial_error is not None:
                raise initial_error

        def evaluate(self, expression, *args):
            if expression == 'Integration.city.generatorVersion':
                return '0.5.7-connected-courts'
            if '.courtRoutes.filter' in expression:
                return 4
            if expression == 'CityPublicRealm.validate(Integration.city)':
                return []
            if expression == '(v)=>Integration.setView(v)':
                self.views.append(args[0])
                return None
            if expression == 'Integration.inspect()':
                return {'nonfinite': 0, 'badNormals': 0}
            raise AssertionError('Unexpected evaluate: ' + expression)

        def wait_for_timeout(self, *args):
            pass

        def locator(self, selector):
            assert selector == '#error'
            return self

        def inner_text(self):
            return ''

        def screenshot(self, **kwargs):
            self.captures.append(kwargs)
            index = len(self.captures) - 1
            if index < len(capture_errors) and capture_errors[index] is not None:
                raise capture_errors[index]

    class Browser:
        closed = False

        def close(self):
            self.closed = True

    page, browser = Page(), Browser()
    report = {'errors': []}
    raised = None
    with tempfile.TemporaryDirectory() as directory:
        env = {'page': page, 'browser': browser, 'report': report,
               'BASE': 'https://example.invalid/',
               'expected': {'src/building-plan.js': 'fixture'},
               'OUT': Path(directory), 'json': json}
        try:
            exec(code, env)
        except Exception as error:
            raised = error
        saved = json.loads((Path(directory) / 'report.json').read_text())
    return raised, page, browser, saved


class DiagnosticsTest(unittest.TestCase):
    target = ROOT / 'tools/verify_cityworks_live.py'

    def test_preserves_original_when_failure_capture_fails(self):
        original = RuntimeError('ready check failed')
        secondary = TimeoutError('failure screenshot timed out')
        raised, page, browser, report = exercise(self.target, original, [secondary])
        self.assertIs(raised, original)
        self.assertEqual(report['status'], 'failed')
        self.assertEqual(report['exception'], str(original))
        self.assertEqual(report['failureScreenshotException'], str(secondary))
        self.assertEqual(page.captures[0]['timeout'], 5000)
        self.assertTrue(browser.closed)

    def test_retains_first_screenshot_failure_not_secondary(self):
        original = TimeoutError('district capture failed')
        secondary = TimeoutError('failure capture failed')
        raised, page, browser, report = exercise(self.target, capture_errors=[original, secondary])
        self.assertIs(raised, original)
        self.assertEqual(report['exception'], str(original))
        self.assertEqual(report['failureScreenshotException'], str(secondary))
        self.assertEqual(len(page.captures), 2)
        self.assertTrue(browser.closed)

    def test_successful_failure_capture_still_raises_original(self):
        original = AssertionError('actual assertion failed')
        raised, page, browser, report = exercise(self.target, original)
        self.assertIs(raised, original)
        self.assertNotIn('failureScreenshotException', report)
        self.assertTrue(browser.closed)

    def test_success_path_unchanged(self):
        raised, page, browser, report = exercise(self.target)
        self.assertIsNone(raised)
        self.assertEqual(report, {'errors': [], 'inspect': {'nonfinite': 0, 'badNormals': 0}, 'status': 'passed'})
        self.assertEqual(page.views, ['district', 'street'])
        self.assertEqual([Path(c['path']).name for c in page.captures], ['district.png', 'street.png'])
        self.assertTrue(all(set(c) == {'path'} for c in page.captures))
        self.assertTrue(browser.closed)

    def test_baseline_reproduces_masking(self):
        baseline = ROOT / 'baseline_verify_cityworks_live.py'
        if not baseline.exists():
            self.skipTest('Historical negative control not present')
        original, secondary = RuntimeError('actual failure'), TimeoutError('capture timeout')
        raised, _, _, report = exercise(baseline, original, [secondary])
        self.assertIs(raised, secondary)
        self.assertEqual(report['exception'], str(original))


if __name__ == '__main__':
    unittest.main()
