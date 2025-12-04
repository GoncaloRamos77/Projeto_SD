# CI/CD Workflow Unit Tests

This directory contains unit tests for the GitHub Actions CI/CD workflow defined in `ci-cd.yml`.

## Test Coverage

The test suite (`test-ci-cd.sh`) validates the following scenarios:

### 1. Change Detection Tests
Tests that the `detect-changes` job correctly identifies changes in specific directories:

- ✅ **Test Case 1**: Changes in `src/producer` directory set `producer=true`
- ✅ **Test Case 2**: Changes in `src/consumer` directory set `consumer=true`
- ✅ **Test Case 3**: Changes in `src/ui` directory set `ui=true`

### 2. Multiple Directory Changes
- ✅ Changes in multiple directories are detected simultaneously
- ✅ Changes in all three directories are detected correctly
- ✅ No false positives when changes are outside `src/` directories

### 3. Nested Subdirectories
- ✅ Changes in nested subdirectories (e.g., `src/producer/utils/`) correctly trigger detection

### 4. Edge Cases
- ✅ Similar directory names (e.g., `src/producer-test/`) don't trigger false positives
- ✅ Exact path matching works correctly

### 5. Build Job Triggers
Tests that build jobs are triggered correctly based on change detection:

- ✅ **Test Case 4**: `build-producer` job runs only when `producer=true`
- ✅ **Test Case 5**: `build-consumer` job runs only when `consumer=true`
- ✅ Build jobs are skipped when their respective change flag is `false`

## Running the Tests

### Prerequisites
- Bash shell (3.2 or higher)
- Unix-like environment (macOS, Linux, WSL)

### Execute Tests
```bash
# From the project root
./.github/workflows/test-ci-cd.sh

# Or with explicit bash
bash .github/workflows/test-ci-cd.sh
```

### Expected Output
```
========================================
CI/CD Workflow Unit Tests
========================================

Test Case 1: Detect changes in src/producer
✓ PASS: Changes in src/producer should set producer=true

Test Case 2: Detect changes in src/consumer
✓ PASS: Changes in src/consumer should set consumer=true

...

========================================
Test Summary
========================================
Tests Passed: 15
Tests Failed: 0
Total Tests:  15
All tests passed!
```

## Test Implementation Details

### Change Detection Logic
The tests simulate the workflow's change detection logic:
```bash
if git diff --name-only HEAD^ HEAD | grep -q '^src/producer/'; then
    echo "producer=true"
else
    echo "producer=false"
fi
```

Each test:
1. Creates a mock list of changed files
2. Runs the detection logic against the mock data
3. Verifies the output matches expected values

### Build Trigger Logic
The tests verify that build jobs respect the conditional:
```yaml
if: needs.detect-changes.outputs.<service> == 'true'
```

## Continuous Integration

These tests can be integrated into the CI/CD pipeline:

```yaml
test-workflow:
  name: Test Workflow Logic
  runs-on: ubuntu-latest
  steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Run workflow tests
      run: bash .github/workflows/test-ci-cd.sh
```

## Maintenance

When updating the `ci-cd.yml` workflow:
1. Update the test cases if change detection logic changes
2. Add new tests for any new build jobs
3. Ensure all tests pass before merging changes

## Exit Codes
- `0`: All tests passed
- `1`: One or more tests failed
