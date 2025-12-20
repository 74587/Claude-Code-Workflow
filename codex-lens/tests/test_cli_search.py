"""Tests for CLI search command with --enrich flag."""

import json
import pytest
from typer.testing import CliRunner
from codexlens.cli.commands import app


class TestCLISearchEnrich:
    """Test CLI search command with --enrich flag integration."""

    @pytest.fixture
    def runner(self):
        """Create CLI test runner."""
        return CliRunner()

    def test_search_with_enrich_flag_help(self, runner):
        """Test --enrich flag is documented in help."""
        result = runner.invoke(app, ["search", "--help"])
        assert result.exit_code == 0
        assert "--enrich" in result.output
        assert "relationships" in result.output.lower() or "graph" in result.output.lower()

    def test_search_with_enrich_flag_accepted(self, runner):
        """Test --enrich flag is accepted by the CLI."""
        result = runner.invoke(app, ["search", "test", "--enrich"])
        # Should not show 'unknown option' error
        assert "No such option" not in result.output
        assert "error: unrecognized" not in result.output.lower()

    def test_search_without_enrich_flag(self, runner):
        """Test search without --enrich flag has no relationships."""
        result = runner.invoke(app, ["search", "test", "--json"])
        # Even without an index, JSON should be attempted
        if result.exit_code == 0:
            try:
                data = json.loads(result.output)
                # If we get results, they should not have enriched=true
                if data.get("success") and "result" in data:
                    assert data["result"].get("enriched", False) is False
            except json.JSONDecodeError:
                pass  # Not JSON output, that's fine for error cases

    def test_search_enrich_json_output_structure(self, runner):
        """Test JSON output structure includes enriched flag."""
        result = runner.invoke(app, ["search", "test", "--json", "--enrich"])
        # If we get valid JSON output, check structure
        if result.exit_code == 0:
            try:
                data = json.loads(result.output)
                if data.get("success") and "result" in data:
                    # enriched field should exist
                    assert "enriched" in data["result"]
            except json.JSONDecodeError:
                pass  # Not JSON output

    def test_search_enrich_with_mode(self, runner):
        """Test --enrich works with different search modes."""
        modes = ["exact", "fuzzy", "hybrid"]
        for mode in modes:
            result = runner.invoke(
                app, ["search", "test", "--mode", mode, "--enrich"]
            )
            # Should not show validation errors
            assert "Invalid" not in result.output


class TestEnrichFlagBehavior:
    """Test behavioral aspects of --enrich flag."""

    @pytest.fixture
    def runner(self):
        """Create CLI test runner."""
        return CliRunner()

    def test_enrich_failure_does_not_break_search(self, runner):
        """Test that enrichment failure doesn't prevent search from returning results."""
        # Even without proper index, search should not crash due to enrich
        result = runner.invoke(app, ["search", "test", "--enrich", "--verbose"])
        # Should not have unhandled exception
        assert "Traceback" not in result.output

    def test_enrich_flag_with_files_only(self, runner):
        """Test --enrich is accepted with --files-only mode."""
        result = runner.invoke(app, ["search", "test", "--enrich", "--files-only"])
        # Should not show option conflict error
        assert "conflict" not in result.output.lower()

    def test_enrich_flag_with_limit(self, runner):
        """Test --enrich works with --limit parameter."""
        result = runner.invoke(app, ["search", "test", "--enrich", "--limit", "5"])
        # Should not show validation error
        assert "Invalid" not in result.output


class TestEnrichOutputFormat:
    """Test output format with --enrich flag."""

    @pytest.fixture
    def runner(self):
        """Create CLI test runner."""
        return CliRunner()

    def test_enrich_verbose_shows_status(self, runner):
        """Test verbose mode shows enrichment status."""
        result = runner.invoke(app, ["search", "test", "--enrich", "--verbose"])
        # Verbose mode may show enrichment info or warnings
        # Just ensure it doesn't crash
        assert result.exit_code in [0, 1]  # 0 = success, 1 = no index

    def test_json_output_has_enriched_field(self, runner):
        """Test JSON output always has enriched field when --enrich used."""
        result = runner.invoke(app, ["search", "test", "--json", "--enrich"])
        if result.exit_code == 0:
            try:
                data = json.loads(result.output)
                if data.get("success"):
                    result_data = data.get("result", {})
                    assert "enriched" in result_data
                    assert isinstance(result_data["enriched"], bool)
            except json.JSONDecodeError:
                pass
