# Scraper Test Scripts

This directory contains scripts for testing the various scrapers in the project.

## test-scrapers.ts

This script tests both the BringATrailerResultsScraper and BringATrailerActiveListingScraper by fetching auction listings from Bring a Trailer and displaying the results.

### Usage

```bash
# Basic usage with default parameters
npx ts-node scripts/test-scrapers.ts

# Specify a make
npx ts-node scripts/test-scrapers.ts --make "Porsche"

# Specify a make and model
npx ts-node scripts/test-scrapers.ts --make "Porsche" --model "911"

# Specify mode (completed, active, or both)
npx ts-node scripts/test-scrapers.ts --mode "completed"

# Specify maximum number of pages to scrape
npx ts-node scripts/test-scrapers.ts --maxPages 5

# Specify delay between requests (in milliseconds)
npx ts-node scripts/test-scrapers.ts --delay 2000

# Process multiple makes from a file
npx ts-node scripts/test-scrapers.ts --makesFile "scripts/sample-makes.txt"
```

### Command Line Arguments

| Argument | Description | Default |
|----------|-------------|---------|
| `--mode` | Mode to run the scraper in (completed, active, both) | both |
| `--make` | Make to search for | Porsche |
| `--model` | Model to search for | (empty) |
| `--maxPages` | Maximum number of pages to scrape | 3 |
| `--delay` | Delay between requests in milliseconds | 100 |
| `--pauseInterval` | Number of pages after which to pause for a longer time | 10 |
| `--pauseDelay` | Duration of the longer pause in milliseconds | 30000 |
| `--makesFile` | Path to a file containing a list of makes to process | (empty) |

### Makes File Format

The makes file should contain one make per line. Empty lines and lines starting with `#` are ignored.

Example:
```
# This is a comment
Porsche
BMW
Mercedes-Benz
```

### Output

The script will create a `results` directory in the project root and save the scraped data as JSON files. 