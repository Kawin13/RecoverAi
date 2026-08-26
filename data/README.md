# RecoverAI Data Directory

This directory stores generated synthetic datasets, raw transaction failure traces, and processed training partitions for RecoverAI.

## Directory Structure

```text
data/
├── raw/
│   └── synthetic_transactions.csv   # 35,000 raw transaction records with failure & recovery outcomes
└── processed/
    ├── training_data.csv            # Clean, leakage-free feature set (35,000 rows)
    ├── train.csv                    # 70% Train split (24,500 rows)
    ├── val.csv                      # 15% Validation split (5,250 rows)
    └── test.csv                     # 15% Test split (5,250 rows)
```

## Generation & Verification

To regenerate the dataset with fixed random seeds, execute:
```bash
python scripts/generate_synthetic_data.py
```
For detailed statistical profiles and assumptions, see [`docs/dataset_specification.md`](../docs/dataset_specification.md).
