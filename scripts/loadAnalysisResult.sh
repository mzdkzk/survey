#!/bin/sh

sqlite3 -csv ./dataset/dataset.db ".import ./output/repository_versions.csv repository_versions"
sqlite3 -csv ./dataset/dataset.db ".import ./output/analysis_result.csv analysis_result"
