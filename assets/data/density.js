// GENERATED — do not edit. Run `npm run build-site` in tools/ after changing tools/measure-density.mjs or data/reading-speed-sources.json.
export const MEASURED_AT = "2026-09-02";

export const TOKENIZERS = [
  {
    "id": "o200k_base",
    "label": "GPT-4o / GPT-5 (o200k_base)",
    "exactAvailable": true,
    "charsPerToken": {
      "ko": 1.702,
      "en": 4.645
    },
    "tokenRatioVsEnglish": {
      "ko": 1.392,
      "en": 1
    }
  },
  {
    "id": "cl100k_base",
    "label": "GPT-4 / GPT-3.5 (cl100k_base)",
    "exactAvailable": false,
    "charsPerToken": {
      "ko": 1.022,
      "en": 4.54
    },
    "tokenRatioVsEnglish": {
      "ko": 2.264,
      "en": 1
    }
  },
  {
    "id": "llama-3.1",
    "label": "Llama 3.1",
    "exactAvailable": false,
    "charsPerToken": {
      "ko": 1.665,
      "en": 4.54
    },
    "tokenRatioVsEnglish": {
      "ko": 1.39,
      "en": 1
    }
  },
  {
    "id": "qwen-3",
    "label": "Qwen3",
    "exactAvailable": false,
    "charsPerToken": {
      "ko": 1.528,
      "en": 4.505
    },
    "tokenRatioVsEnglish": {
      "ko": 1.504,
      "en": 1
    }
  },
  {
    "id": "gemma-3",
    "label": "Gemma 3",
    "exactAvailable": false,
    "charsPerToken": {
      "ko": 1.857,
      "en": 4.464
    },
    "tokenRatioVsEnglish": {
      "ko": 1.226,
      "en": 1
    }
  },
  {
    "id": "mistral-small",
    "label": "Mistral Small 3",
    "exactAvailable": false,
    "charsPerToken": {
      "ko": 1.942,
      "en": 4.48
    },
    "tokenRatioVsEnglish": {
      "ko": 1.177,
      "en": 1
    }
  }
];

export const READING_PACE = {
  "ko": {
    "available": true,
    "rate": 549.7,
    "rateUnit": "chars/min",
    "unit": "char",
    "tokensPerSecond": {
      "o200k_base": 5.38,
      "cl100k_base": 8.96,
      "llama-3.1": 5.5,
      "qwen-3": 6,
      "gemma-3": 4.93,
      "mistral-small": 4.72
    },
    "readerSpread": [
      1.97,
      8.8
    ],
    "source": "송지호, 김재형, 형성민 (2016). 한국어 읽기 속도 측정 애플리케이션의 유효성 및 정상인의 읽기 속도에 대한 사전 연구. 대한안과학회지, 57(4), 642-649.",
    "sourceUrl": "https://www.jkos.org/upload/pdf/JKOS057-04-17.pdf"
  },
  "en": {
    "available": true,
    "rate": 238,
    "rateUnit": "words/min",
    "unit": "word",
    "tokensPerSecond": {
      "o200k_base": 4.73,
      "cl100k_base": 4.84,
      "llama-3.1": 4.84,
      "qwen-3": 4.88,
      "gemma-3": 4.93,
      "mistral-small": 4.91
    },
    "readerSpread": [
      3.48,
      5.97
    ],
    "source": "Brysbaert, M. (2019). How many words do we read per minute? A review and meta-analysis of reading rate. Journal of Memory and Language, 109, 104047.",
    "sourceUrl": "https://doi.org/10.1016/j.jml.2019.104047"
  }
};
