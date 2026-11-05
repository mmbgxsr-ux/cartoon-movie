// فحص ساكن لحزمة dist/_lint_bundle.js (ملفات المشروع مجمّعة بترتيب التحميل، فهي تتشارك نطاقًا عامًا واحدًا)
import globals from 'globals';
export default [{
  files: ['dist/_lint_bundle.js'],
  languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: { ...globals.browser } },
  rules: { 'no-undef': 'error', 'no-redeclare': 'error' }
}];
