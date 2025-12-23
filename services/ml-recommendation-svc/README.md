# ML Recommendation Service

A Python-based microservice that provides machine learning-powered learning recommendations for SkillPod.

## Overview

This service provides:

- **Skill Gap Analysis**: ML-based detection of skill gaps from market activity
- **Content Recommendations**: Personalized course/content recommendations using collaborative filtering and content-based algorithms
- **Learning Path Generation**: Optimized learning path sequences using reinforcement learning
- **Trend Predictions**: Time-series forecasting for skill demand trends

## Architecture

```
ml-recommendation-svc/
├── app/
│   ├── api/           # FastAPI routes
│   ├── models/        # ML model definitions
│   ├── services/      # Business logic
│   ├── schemas/       # Pydantic models
│   └── utils/         # Helper utilities
├── ml/
│   ├── training/      # Model training scripts
│   └── inference/     # Inference pipelines
├── tests/             # Unit and integration tests
└── docker/            # Docker configuration
```

## Tech Stack

- **FastAPI**: High-performance async API framework
- **scikit-learn**: Traditional ML algorithms
- **LightGBM**: Gradient boosting for ranking/scoring
- **Sentence Transformers**: Text embeddings for content similarity
- **Redis**: Caching for embeddings and predictions
- **PostgreSQL**: Feature store and model metadata

## API Endpoints

### Recommendations

- `POST /api/v1/recommendations/generate` - Generate recommendations for a user
- `POST /api/v1/recommendations/batch` - Batch recommendation generation

### Skill Gap Analysis

- `POST /api/v1/skill-gaps/analyze` - Analyze skill gaps from activity
- `POST /api/v1/skill-gaps/predict` - Predict skill gap impacts

### Market Trends

- `GET /api/v1/trends/forecast/{skill_id}` - Forecast skill demand
- `POST /api/v1/trends/analyze` - Batch trend analysis

### Model Management

- `GET /api/v1/models/status` - Get model status
- `POST /api/v1/models/retrain` - Trigger model retraining (admin)

## Setup

### Local Development

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
.\venv\Scripts\Activate.ps1  # Windows

# Install dependencies
pip install -r requirements.txt

# Run development server
uvicorn app.main:app --reload --port 8080
```

### Docker

```bash
docker build -t ml-recommendation-svc .
docker run -p 8080:8080 ml-recommendation-svc
```

## Environment Variables

| Variable          | Description                  | Default                  |
| ----------------- | ---------------------------- | ------------------------ |
| `DATABASE_URL`    | PostgreSQL connection string | -                        |
| `REDIS_URL`       | Redis connection string      | `redis://localhost:6379` |
| `MODEL_PATH`      | Path to trained models       | `./models`               |
| `LOG_LEVEL`       | Logging level                | `INFO`                   |
| `EMBEDDING_MODEL` | Sentence transformer model   | `all-MiniLM-L6-v2`       |

## Model Training

Models are trained on:

1. User skill profiles and career trajectories
2. Job application outcomes (success/rejection patterns)
3. Market trend historical data
4. Content engagement metrics

See `ml/training/README.md` for training instructions.
