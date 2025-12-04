#!/bin/bash

# Unit Tests for CI/CD Workflow Change Detection
# Tests the detect-changes job logic and build job triggers

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to print test results
print_test_result() {
    local test_name="$1"
    local result="$2"
    
    if [ "$result" = "PASS" ]; then
        echo -e "${GREEN}✓ PASS${NC}: $test_name"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC}: $test_name"
        ((TESTS_FAILED++))
    fi
}

# Function to simulate git diff output and test change detection
test_change_detection() {
    local test_name="$1"
    local changed_files="$2"
    local expected_producer="$3"
    local expected_consumer="$4"
    local expected_ui="$5"
    
    # Create temporary file with changed files
    echo "$changed_files" > /tmp/git_diff_output.txt
    
    # Simulate the detect-changes logic
    if grep -q '^src/producer/' /tmp/git_diff_output.txt; then
        producer="true"
    else
        producer="false"
    fi
    
    if grep -q '^src/consumer/' /tmp/git_diff_output.txt; then
        consumer="true"
    else
        consumer="false"
    fi
    
    if grep -q '^src/ui/' /tmp/git_diff_output.txt; then
        ui="true"
    else
        ui="false"
    fi
    
    # Verify results
    if [ "$producer" = "$expected_producer" ] && \
       [ "$consumer" = "$expected_consumer" ] && \
       [ "$ui" = "$expected_ui" ]; then
        print_test_result "$test_name" "PASS"
    else
        echo -e "${RED}✗ FAIL${NC}: $test_name"
        echo "  Expected: producer=$expected_producer, consumer=$expected_consumer, ui=$expected_ui"
        echo "  Got:      producer=$producer, consumer=$consumer, ui=$ui"
        ((TESTS_FAILED++))
    fi
    
    # Cleanup
    rm -f /tmp/git_diff_output.txt
}

# Function to test build job trigger logic
test_build_trigger() {
    local test_name="$1"
    local job_name="$2"
    local output_value="$3"
    local expected_run="$4"
    
    # Simulate the job condition: needs.detect-changes.outputs.<service> == 'true'
    if [ "$output_value" = "true" ]; then
        should_run="true"
    else
        should_run="false"
    fi
    
    if [ "$should_run" = "$expected_run" ]; then
        print_test_result "$test_name" "PASS"
    else
        echo -e "${RED}✗ FAIL${NC}: $test_name"
        echo "  Expected $job_name to run: $expected_run"
        echo "  Got: $should_run"
        ((TESTS_FAILED++))
    fi
}

echo "========================================"
echo "CI/CD Workflow Unit Tests"
echo "========================================"
echo ""

# Test Case 1: Changes in src/producer directory
echo "Test Case 1: Detect changes in src/producer"
test_change_detection \
    "Changes in src/producer should set producer=true" \
    "src/producer/main.py
src/producer/Dockerfile" \
    "true" "false" "false"

# Test Case 2: Changes in src/consumer directory
echo ""
echo "Test Case 2: Detect changes in src/consumer"
test_change_detection \
    "Changes in src/consumer should set consumer=true" \
    "src/consumer/server.js
src/consumer/package.json" \
    "false" "true" "false"

# Test Case 3: Changes in src/ui directory
echo ""
echo "Test Case 3: Detect changes in src/ui"
test_change_detection \
    "Changes in src/ui should set ui=true" \
    "src/ui/index.html
src/ui/styles.css" \
    "false" "false" "true"

# Test Case 4: Changes in multiple directories
echo ""
echo "Test Case 4: Detect changes in multiple directories"
test_change_detection \
    "Changes in producer and consumer should set both to true" \
    "src/producer/main.py
src/consumer/server.js" \
    "true" "true" "false"

test_change_detection \
    "Changes in all three directories should set all to true" \
    "src/producer/main.py
src/consumer/server.js
src/ui/index.html" \
    "true" "true" "true"

# Test Case 5: No changes in src directories
echo ""
echo "Test Case 5: Detect no changes in src directories"
test_change_detection \
    "Changes outside src should set all to false" \
    "README.md
k8s/producer/deployment.yaml" \
    "false" "false" "false"

# Test Case 6: Changes in nested subdirectories
echo ""
echo "Test Case 6: Detect changes in nested subdirectories"
test_change_detection \
    "Changes in src/producer/subdir should set producer=true" \
    "src/producer/utils/helper.py
src/producer/config/settings.json" \
    "true" "false" "false"

# Test Case 7: Edge cases with similar paths
echo ""
echo "Test Case 7: Edge cases with path matching"
test_change_detection \
    "Changes in src/producer-test should not trigger producer" \
    "src/producer-test/file.py" \
    "false" "false" "false"

test_change_detection \
    "Changes exactly in src/producer/ should trigger producer" \
    "src/producer/file.py" \
    "true" "false" "false"

# Test Case 8: Build job trigger logic
echo ""
echo "Test Case 8: Build job triggers based on detect-changes output"
test_build_trigger \
    "build-producer should run when producer=true" \
    "build-producer" "true" "true"

test_build_trigger \
    "build-producer should NOT run when producer=false" \
    "build-producer" "false" "false"

echo ""
echo "Test Case 9: Build consumer job triggers"
test_build_trigger \
    "build-consumer should run when consumer=true" \
    "build-consumer" "true" "true"

test_build_trigger \
    "build-consumer should NOT run when consumer=false" \
    "build-consumer" "false" "false"

echo ""
echo "Test Case 10: Build UI job triggers"
test_build_trigger \
    "build-ui should run when ui=true" \
    "build-ui" "true" "true"

test_build_trigger \
    "build-ui should NOT run when ui=false" \
    "build-ui" "false" "false"

# Summary
echo ""
echo "========================================"
echo "Test Summary"
echo "========================================"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo "Total Tests:  $((TESTS_PASSED + TESTS_FAILED))"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi
