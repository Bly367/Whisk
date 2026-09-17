import fs from 'node:fs';
import path from 'node:path';

/**
 * Guards W8 CI against false-green regressions (missing scripts echoing pass).
 * Pure Node/Jest — no React Native runtime required.
 */
describe('CI workflow contract', () => {
  const workflowPath = path.join(__dirname, '..', '.github', 'workflows', 'ci.yml');
  const workflow = fs.readFileSync(workflowPath, 'utf8');

  it('requires lint, typecheck, and test scripts when package.json is present', () => {
    expect(workflow).toContain('Require lint, typecheck, and test scripts');
    expect(workflow).toContain("required = ['lint', 'typecheck', 'test']");
    expect(workflow).toMatch(/process\.exit\(1\)/);
  });

  it('does not soft-pass when a required script is missing', () => {
    expect(workflow).not.toMatch(/No lint script yet/);
    expect(workflow).not.toMatch(/No typecheck script yet/);
    expect(workflow).not.toMatch(/No test script yet/);
  });

  it('still skips Node jobs when package.json is absent', () => {
    expect(workflow).toContain("steps.app.outputs.present != 'true'");
    expect(workflow).toContain('Standards placeholder (pre-app)');
  });

  it('runs lint, typecheck, and test only after the script gate', () => {
    const requireIdx = workflow.indexOf('Require lint, typecheck, and test scripts');
    const lintIdx = workflow.indexOf('npm run lint');
    const typecheckIdx = workflow.indexOf('npm run typecheck');
    const testIdx = workflow.indexOf('npm test');

    expect(requireIdx).toBeGreaterThan(-1);
    expect(lintIdx).toBeGreaterThan(requireIdx);
    expect(typecheckIdx).toBeGreaterThan(requireIdx);
    expect(testIdx).toBeGreaterThan(requireIdx);
  });
});
