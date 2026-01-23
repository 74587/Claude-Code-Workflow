#!/usr/bin/env node

/**
 * Chain Validation Tool
 * 
 * Validates workflow command chains against defined rules.
 * 
 * Usage:
 *   node chain-validate.js plan execute test-cycle-execute
 *   node chain-validate.js --json "plan,execute,test-cycle-execute"
 *   node chain-validate.js --file custom-chain.json
 */

const fs = require('fs');
const path = require('path');

// Load registry
const registryPath = path.join(__dirname, '..', 'specs', 'chain-registry.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

class ChainValidator {
  constructor(registry) {
    this.registry = registry;
    this.errors = [];
    this.warnings = [];
  }

  validate(chain) {
    this.errors = [];
    this.warnings = [];

    this.validateSinglePlanning(chain);
    this.validateCompatiblePairs(chain);
    this.validateTestingPosition(chain);
    this.validateReviewPosition(chain);
    this.validateBugfixStandalone(chain);
    this.validateDependencies(chain);
    this.validateNoRedundancy(chain);
    this.validateCommandExistence(chain);

    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings
    };
  }

  validateSinglePlanning(chain) {
    const planningCommands = chain.filter(cmd => 
      ['plan', 'lite-plan', 'multi-cli-plan', 'tdd-plan'].includes(cmd)
    );

    if (planningCommands.length > 1) {
      this.errors.push({
        rule: 'Single Planning Command',
        message: `Too many planning commands: ${planningCommands.join(', ')}`,
        severity: 'error'
      });
    }
  }

  validateCompatiblePairs(chain) {
    const compatibility = {
      'lite-plan': ['lite-execute'],
      'multi-cli-plan': ['lite-execute', 'execute'],
      'plan': ['execute'],
      'tdd-plan': ['execute']
    };

    const planningCmd = chain.find(cmd => 
      ['plan', 'lite-plan', 'multi-cli-plan', 'tdd-plan'].includes(cmd)
    );

    const executionCmd = chain.find(cmd => 
      ['execute', 'lite-execute'].includes(cmd)
    );

    if (planningCmd && executionCmd) {
      const compatible = compatibility[planningCmd] || [];
      if (!compatible.includes(executionCmd)) {
        this.errors.push({
          rule: 'Compatible Pairs',
          message: `${planningCmd} incompatible with ${executionCmd}`,
          fix: `Use ${planningCmd} with ${compatible.join(' or ')}`,
          severity: 'error'
        });
      }
    }
  }

  validateTestingPosition(chain) {
    const executionIdx = chain.findIndex(cmd => 
      ['execute', 'lite-execute', 'develop-with-file'].includes(cmd)
    );

    const testingIdx = chain.findIndex(cmd => 
      ['test-cycle-execute', 'tdd-verify', 'test-gen', 'test-fix-gen'].includes(cmd)
    );

    if (testingIdx !== -1 && executionIdx !== -1 && executionIdx > testingIdx) {
      this.errors.push({
        rule: 'Testing After Execution',
        message: 'Testing commands must come after execution',
        severity: 'error'
      });
    }

    if (testingIdx !== -1 && executionIdx === -1) {
      const hasTestGen = chain.some(cmd => ['test-gen', 'test-fix-gen'].includes(cmd));
      if (!hasTestGen) {
        this.warnings.push({
          rule: 'Testing After Execution',
          message: 'test-cycle-execute without execution context - needs test-gen or execute first',
          severity: 'warning'
        });
      }
    }
  }

  validateReviewPosition(chain) {
    const executionIdx = chain.findIndex(cmd => 
      ['execute', 'lite-execute'].includes(cmd)
    );

    const reviewIdx = chain.findIndex(cmd => 
      cmd.includes('review')
    );

    if (reviewIdx !== -1 && executionIdx !== -1 && executionIdx > reviewIdx) {
      this.errors.push({
        rule: 'Review After Changes',
        message: 'Review commands must come after execution',
        severity: 'error'
      });
    }

    if (reviewIdx !== -1 && executionIdx === -1) {
      const isModuleReview = chain[reviewIdx] === 'review-module-cycle';
      if (!isModuleReview) {
        this.warnings.push({
          rule: 'Review After Changes',
          message: 'Review without execution - needs git changes to review',
          severity: 'warning'
        });
      }
    }
  }

  validateBugfixStandalone(chain) {
    if (chain.includes('lite-fix')) {
      const others = chain.filter(cmd => cmd !== 'lite-fix');
      if (others.length > 0) {
        this.errors.push({
          rule: 'BugFix Standalone',
          message: 'lite-fix must be standalone, cannot combine with other commands',
          fix: 'Use lite-fix alone OR use plan + execute for larger changes',
          severity: 'error'
        });
      }
    }
  }

  validateDependencies(chain) {
    for (let i = 0; i < chain.length; i++) {
      const cmd = chain[i];
      const cmdMeta = this.registry.commands[cmd];
      
      if (!cmdMeta) continue;

      const deps = cmdMeta.dependencies || [];
      const depsOptional = cmdMeta.dependencies_optional || false;

      if (deps.length > 0 && !depsOptional) {
        const hasDependency = deps.some(dep => {
          const depIdx = chain.indexOf(dep);
          return depIdx !== -1 && depIdx < i;
        });

        if (!hasDependency) {
          this.errors.push({
            rule: 'Dependency Satisfaction',
            message: `${cmd} requires ${deps.join(' or ')} before it`,
            severity: 'error'
          });
        }
      }
    }
  }

  validateNoRedundancy(chain) {
    const seen = new Set();
    const duplicates = [];

    for (const cmd of chain) {
      if (seen.has(cmd)) {
        duplicates.push(cmd);
      }
      seen.add(cmd);
    }

    if (duplicates.length > 0) {
      this.errors.push({
        rule: 'No Redundant Commands',
        message: `Duplicate commands: ${duplicates.join(', ')}`,
        severity: 'error'
      });
    }
  }

  validateCommandExistence(chain) {
    for (const cmd of chain) {
      if (!this.registry.commands[cmd]) {
        this.errors.push({
          rule: 'Command Existence',
          message: `Unknown command: ${cmd}`,
          severity: 'error'
        });
      }
    }
  }
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage:');
    console.log('  chain-validate.js <command1> <command2> ...');
    console.log('  chain-validate.js --json "cmd1,cmd2,cmd3"');
    console.log('  chain-validate.js --file chain.json');
    process.exit(1);
  }

  let chain;

  if (args[0] === '--json') {
    chain = args[1].split(',').map(s => s.trim());
  } else if (args[0] === '--file') {
    const filePath = args[1];
    const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    chain = fileContent.chain || fileContent.steps.map(s => s.command);
  } else {
    chain = args;
  }

  const validator = new ChainValidator(registry);
  const result = validator.validate(chain);

  console.log('\n=== Chain Validation Report ===\n');
  console.log('Chain:', chain.join(' → '));
  console.log('');

  if (result.valid) {
    console.log('✓ Chain is valid!\n');
  } else {
    console.log('✗ Chain has errors:\n');
    result.errors.forEach(err => {
      console.log(`  [${err.rule}] ${err.message}`);
      if (err.fix) {
        console.log(`    Fix: ${err.fix}`);
      }
    });
    console.log('');
  }

  if (result.warnings.length > 0) {
    console.log('⚠ Warnings:\n');
    result.warnings.forEach(warn => {
      console.log(`  [${warn.rule}] ${warn.message}`);
    });
    console.log('');
  }

  process.exit(result.valid ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = { ChainValidator };
