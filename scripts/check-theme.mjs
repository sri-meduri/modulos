#!/usr/bin/env node
/**
 * Design-system guard. Fails (exit 1) when UI code bypasses the theme:
 *   - hex / rgb() / hsl() colors outside theme/
 *   - fontFamily / fontSize / fontWeight outside theme/ (use <Text variant>)
 *   - Text / TextInput imported from react-native outside the ui primitives
 *   - other icon libraries (use theme/icons + <Icon>)
 *   - raw numeric padding / margin / gap / borderRadius in screens, app/ and
 *     shared components (use space.* / radius.* tokens)
 * See docs/DESIGN.md.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const SCAN = ['app', 'screens', 'components', 'contexts', 'hooks', 'lib'];
const SKIP_DIR = new Set(['node_modules', 'dist', '.expo']);

const walk = dir => readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    if (SKIP_DIR.has(name)) return [];
    return statSync(full).isDirectory() ? walk(full) : /\.(tsx?|jsx?)$/.test(name) ? [full] : [];
});

const stripComments = src => src.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

const isUiPrimitive = file => file.startsWith(`components${sep}ui${sep}`);

const RULES = [
    { name: 'hard-coded color', re: /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/g, appliesTo: () => true, fix: 'use `colors` from theme' },
    { name: 'raw font style', re: /\b(?:fontFamily|fontSize|fontWeight)\s*:/g, appliesTo: () => true, fix: 'use <Text variant="..."> / textStyle()' },
    { name: 'react-native Text import', re: /import\s*\{[^}]*\bText(?:Input)?\b[^}]*\}\s*from\s*['"]react-native['"]/g, appliesTo: f => !isUiPrimitive(f), fix: 'import Text/Field from components/ui' },
    { name: 'other icon library', re: /from\s*['"](?:@expo\/vector-icons|lucide[^'"]*|react-native-vector-icons[^'"]*|@heroicons[^'"]*)['"]/g, appliesTo: () => true, fix: 'add the icon to theme/icons.ts and use <Icon>' },
    { name: 'raw spacing/radius number', re: /\b(?:padding(?:Horizontal|Vertical|Top|Bottom|Left|Right)?|margin(?:Horizontal|Vertical|Top|Bottom|Left|Right)?|gap|borderRadius)\s*:\s*-?\d/g, appliesTo: f => !isUiPrimitive(f), fix: 'use space.* / radius.* tokens (or a layout primitive)' },
];

let failures = 0;
for (const dir of SCAN) {
    let files = [];
    try { files = walk(join(ROOT, dir)); } catch { continue; }
    for (const abs of files) {
        const file = relative(ROOT, abs);
        const src = stripComments(readFileSync(abs, 'utf8'));
        for (const rule of RULES) {
            if (!rule.appliesTo(file)) continue;
            for (const m of src.matchAll(rule.re)) {
                const line = src.slice(0, m.index).split('\n').length;
                console.error(`${file}:${line}  ${rule.name}: "${m[0].trim()}"  -> ${rule.fix}`);
                failures++;
            }
        }
    }
}

if (failures) {
    console.error(`\n${failures} design-system violation(s). Theme lives in theme/ (see docs/DESIGN.md).`);
    process.exit(1);
}
console.log('Theme check passed: all UI uses the shared theme.');
