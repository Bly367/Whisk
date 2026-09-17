import fs from 'node:fs';
import path from 'node:path';

/**
 * Characterization / presence guards for Phase 2 engineering standards.
 * These lock required docs into the repo — not feature behavior under TDD.
 */
describe('Security & Phase 2 standards docs', () => {
  const root = path.join(__dirname, '..');

  it('ships SECURITY.md with core controls', () => {
    const security = fs.readFileSync(path.join(root, 'SECURITY.md'), 'utf8');
    expect(security).toMatch(/# Whisk Security Standards/);
    expect(security).toMatch(/No secrets in the client/i);
    expect(security).toMatch(/Vulnerability reporting/i);
    expect(security).toMatch(/test-first/i);
  });

  it('ships AGENTS.md with mandatory test-first policy', () => {
    const agents = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
    expect(agents).toMatch(/Test-first \(mandatory\)/);
    expect(agents).toMatch(/fails.*right reason/i);
    expect(agents).toMatch(/SECURITY\.md/);
  });

  it('ships Phase 2 roadmap with P2-W1…P2-W8 workstreams', () => {
    const roadmap = fs.readFileSync(path.join(root, 'docs', 'phase-2-roadmap.md'), 'utf8');
    expect(roadmap).toMatch(/# Whisk Phase 2 Roadmap/);
    for (const id of ['P2-W1', 'P2-W2', 'P2-W3', 'P2-W4', 'P2-W5', 'P2-W6', 'P2-W7', 'P2-W8']) {
      expect(roadmap).toContain(id);
    }
    expect(roadmap).toMatch(/test-first/i);
  });

  it('CONTRIBUTING and PR template enforce test-first + SECURITY.md', () => {
    const contributing = fs.readFileSync(path.join(root, 'CONTRIBUTING.md'), 'utf8');
    const prTemplate = fs.readFileSync(
      path.join(root, '.github', 'PULL_REQUEST_TEMPLATE.md'),
      'utf8',
    );
    expect(contributing).toMatch(/Test-first development \(mandatory\)/);
    expect(contributing).toContain('SECURITY.md');
    expect(prTemplate).toMatch(/Test-first/);
    expect(prTemplate).toContain('SECURITY.md');
    expect(prTemplate).toMatch(/red → green/);
  });
});
