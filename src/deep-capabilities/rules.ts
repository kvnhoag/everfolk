import design from "../../design/skill-tree/catalog.json" with { type: "json" };
import type { CapabilityEvidenceTest, CapabilityProof, CapabilityRule } from "./types.ts";

/** Explicit engine-readable proofs: English design text is never interpreted at runtime. */
const proofs: Record<string, CapabilityProof> = {
  "F1": {
    "type": "records",
    "match": {
      "actions": [
        "fieldwork"
      ]
    },
    "count": 1
  },
  "F2": {
    "type": "records",
    "match": {
      "kind": "harvest",
      "actions": [
        "annual-settlement"
      ],
      "facts": {
        "seedDebited": true,
        "seedReserved": true
      }
    },
    "count": 1
  },
  "F3S": {
    "type": "all",
    "proofs": [
      {
        "type": "records",
        "match": {
          "actions": [
            "soil-preparation"
          ]
        },
        "count": 1
      },
      {
        "type": "records",
        "match": {
          "kind": "harvest",
          "actions": [
            "annual-settlement"
          ],
          "facts": {
            "preparedSoil": true,
            "plotsRecorded": true
          }
        },
        "count": 1
      }
    ]
  },
  "F3W": {
    "type": "records",
    "match": {
      "actions": [
        "channel-maintenance"
      ],
      "facts": {
        "feesPaid": true
      }
    },
    "count": 1
  },
  "F4": {
    "type": "records",
    "match": {
      "kind": "harvest",
      "actions": [
        "annual-settlement"
      ],
      "facts": {
        "planRecorded": true,
        "plotsRecorded": true,
        "labourRecorded": true,
        "seedReserved": true
      }
    },
    "count": 1
  },
  "FC5": {
    "type": "records",
    "match": {
      "kind": "harvest",
      "actions": [
        "annual-settlement"
      ],
      "facts": {
        "preparedSoil": true,
        "fullSeedAllocation": true,
        "seedDebited": true
      }
    },
    "count": 1
  },
  "FC6": {
    "type": "records",
    "match": {
      "actions": [
        "crop-care"
      ]
    },
    "count": 2,
    "distinctYears": 2
  },
  "FC7": {
    "type": "records",
    "match": {
      "kind": "harvest",
      "actions": [
        "annual-settlement"
      ],
      "facts": {
        "channelMaintained": true,
        "maintenancePaid": true
      }
    },
    "count": 2,
    "distinctYears": 2
  },
  "FC8": {
    "type": "all",
    "proofs": [
      {
        "type": "records",
        "match": {
          "kind": "harvest",
          "actions": [
            "annual-settlement"
          ],
          "facts": {
            "cropPlan": "grain",
            "seedReserved": true
          }
        },
        "count": 1
      },
      {
        "type": "records",
        "match": {
          "kind": "harvest",
          "actions": [
            "annual-settlement"
          ],
          "facts": {
            "cropPlan": "flax",
            "seedReserved": true
          }
        },
        "count": 1
      }
    ]
  },
  "FC9": {
    "type": "records",
    "match": {
      "kind": "harvest",
      "actions": [
        "annual-settlement"
      ],
      "facts": {
        "planRecorded": true,
        "fullRations": true,
        "reconciled": true
      }
    },
    "count": 2,
    "distinctYears": 2
  },
  "FC10": {
    "type": "records",
    "match": {
      "kind": "harvest",
      "actions": [
        "annual-settlement"
      ],
      "facts": {
        "integratedPlan": true,
        "fullRations": true,
        "seedReserved": true,
        "fullSeedAllocation": true
      }
    },
    "count": 2,
    "distinctYears": 2
  },
  "FR5": {
    "type": "records",
    "match": {
      "kind": "harvest",
      "actions": [
        "annual-settlement"
      ],
      "facts": {
        "grainBefore": {
          "gte": 240
        },
        "grainAfter": {
          "gte": 240
        },
        "fullRations": true
      }
    },
    "count": 1
  },
  "FR6": {
    "type": "records",
    "match": {
      "kind": "harvest",
      "actions": [
        "annual-settlement"
      ],
      "facts": {
        "fullRations": true,
        "seedReserved": true
      },
      "balances": [
        {
          "available": "grainAfter",
          "required": [
            {
              "fact": "annualRation",
              "bps": 10000
            },
            {
              "fact": "seedRequired",
              "bps": 10000
            }
          ]
        }
      ]
    },
    "count": 1
  },
  "FR7": {
    "type": "all",
    "proofs": [
      {
        "type": "records",
        "match": {
          "actions": [
            "store-inspection"
          ],
          "facts": {
            "feesPaid": true
          }
        },
        "count": 1
      },
      {
        "type": "records",
        "match": {
          "actions": [
            "stock-reconciliation"
          ],
          "facts": {
            "reconciled": true
          }
        },
        "count": 1
      }
    ]
  },
  "FR8": {
    "type": "records",
    "match": {
      "kind": "harvest",
      "actions": [
        "annual-settlement"
      ],
      "facts": {
        "fullRations": true,
        "seedReserved": true
      },
      "balances": [
        {
          "available": "grainAfter",
          "required": [
            {
              "fact": "annualRation",
              "bps": 10000
            },
            {
              "fact": "seedRequired",
              "bps": 10000
            }
          ]
        }
      ]
    },
    "count": 2,
    "distinctYears": 2
  },
  "FR9": {
    "type": "any",
    "proofs": [
      {
        "type": "records",
        "match": {
          "kind": "harvest",
          "actions": [
            "annual-settlement"
          ],
          "facts": {
            "flood": "low",
            "reservesUsed": true,
            "fullRations": true
          }
        },
        "count": 1
      },
      {
        "type": "records",
        "match": {
          "kind": "harvest",
          "actions": [
            "annual-settlement"
          ],
          "facts": {
            "fullRations": true,
            "seedReserved": true
          },
          "balances": [
            {
              "available": "grainAfter",
              "required": [
                {
                  "fact": "annualRation",
                  "bps": 15000
                },
                {
                  "fact": "seedRequired",
                  "bps": 10000
                }
              ]
            }
          ]
        },
        "count": 2,
        "distinctYears": 2
      }
    ]
  },
  "FR10": {
    "type": "records",
    "match": {
      "kind": "harvest",
      "actions": [
        "annual-settlement"
      ],
      "facts": {
        "fullRations": true,
        "seedReserved": true,
        "newEmergencyDebt": 0
      }
    },
    "count": 3,
    "distinctYears": 3,
    "consecutiveYears": 3
  },
  "A1": {
    "type": "records",
    "match": {
      "actions": [
        "tool-practice"
      ],
      "facts": {
        "supervised": true
      }
    },
    "count": 1
  },
  "A2": {
    "type": "records",
    "match": {
      "actions": [
        "measurement-exercise"
      ],
      "facts": {
        "errorBps": {
          "lte": 500,
          "gte": 0
        }
      }
    },
    "count": 1
  },
  "A3": {
    "type": "any",
    "proofs": [
      {
        "type": "records",
        "match": {
          "actions": [
            "prepare-textiles"
          ],
          "facts": {
            "paidInputs": true
          }
        },
        "count": 2,
        "distinctYears": 2
      },
      {
        "type": "records",
        "match": {
          "actions": [
            "prepare-clay"
          ],
          "facts": {
            "paidInputs": true
          }
        },
        "count": 2,
        "distinctYears": 2
      },
      {
        "type": "records",
        "match": {
          "actions": [
            "prepare-wood-stone"
          ],
          "facts": {
            "paidInputs": true
          }
        },
        "count": 2,
        "distinctYears": 2
      }
    ]
  },
  "A4": {
    "type": "records",
    "match": {
      "kind": "production",
      "facts": {
        "item": {
          "oneOf": [
            "thread",
            "linen",
            "garment",
            "vessel",
            "clay-model"
          ]
        },
        "quality": {
          "gte": 1
        },
        "quantity": {
          "gte": 1
        },
        "paidInputs": true,
        "reconciled": true,
        "supervised": true
      }
    },
    "count": 2,
    "distinctYears": 2
  },
  "AT5": {
    "type": "records",
    "match": {
      "kind": "production",
      "facts": {
        "item": {
          "oneOf": [
            "garment"
          ]
        },
        "quality": {
          "gte": 1
        },
        "quantity": {
          "gte": 1
        },
        "paidInputs": true,
        "reconciled": true
      }
    },
    "count": 2,
    "distinctYears": 2
  },
  "AT6": {
    "type": "records",
    "match": {
      "kind": "production",
      "facts": {
        "item": {
          "oneOf": [
            "garment",
            "dyed-garment",
            "ceremonial-garment"
          ]
        },
        "quality": {
          "gte": 2
        },
        "quantity": {
          "gte": 1
        },
        "paidInputs": true,
        "reconciled": true
      }
    },
    "count": 2,
    "distinctYears": 2
  },
  "AT7": {
    "type": "records",
    "match": {
      "kind": "production",
      "facts": {
        "item": {
          "oneOf": [
            "garment",
            "dyed-garment",
            "ceremonial-garment"
          ]
        },
        "quality": {
          "gte": 2
        },
        "quantity": {
          "gte": 1
        },
        "paidInputs": true,
        "reconciled": true,
        "inspectionAccepted": true,
        "contract": true
      }
    },
    "count": 2,
    "distinctYears": 2
  },
  "AT8": {
    "type": "records",
    "match": {
      "kind": "production",
      "facts": {
        "item": {
          "oneOf": [
            "garment",
            "dyed-garment",
            "ceremonial-garment"
          ]
        },
        "quality": {
          "gte": 3
        },
        "quantity": {
          "gte": 4
        },
        "paidInputs": true,
        "reconciled": true
      }
    },
    "count": 2,
    "distinctYears": 2
  },
  "AT9": {
    "type": "records",
    "match": {
      "kind": "production",
      "facts": {
        "item": {
          "oneOf": [
            "garment",
            "dyed-garment",
            "ceremonial-garment"
          ]
        },
        "quality": {
          "gte": 3
        },
        "quantity": {
          "gte": 1
        },
        "paidInputs": true,
        "reconciled": true,
        "contract": true,
        "deadlineMet": true,
        "paymentRecorded": true,
        "supplierDebt": 0
      }
    },
    "count": 2,
    "distinctYears": 2
  },
  "AT10": {
    "type": "records",
    "match": {
      "kind": "assessment",
      "actions": [
        "assess-AT10"
      ],
      "facts": {
        "registered": true,
        "accepted": true,
        "paidInputs": true,
        "feesPaid": true,
        "reconciled": true
      },
      "references": {
        "minimum": 2,
        "distinctYears": 2,
        "allMatch": {
          "kind": "production",
          "facts": {
            "item": "ceremonial-garment",
            "quality": {
              "gte": 4
            },
            "paidInputs": true,
            "reconciled": true,
            "inspectionAccepted": true
          }
        },
        "sum": {
          "fact": "quantity",
          "minimum": 4
        }
      }
    },
    "count": 1
  },
  "AC5": {
    "type": "records",
    "match": {
      "kind": "production",
      "facts": {
        "item": {
          "oneOf": [
            "vessel",
            "decorated-vessel"
          ]
        },
        "quality": {
          "gte": 1
        },
        "quantity": {
          "gte": 1
        },
        "paidInputs": true,
        "reconciled": true
      }
    },
    "count": 2,
    "distinctYears": 2
  },
  "AC6": {
    "type": "records",
    "match": {
      "kind": "production",
      "facts": {
        "item": {
          "oneOf": [
            "vessel",
            "decorated-vessel"
          ]
        },
        "quality": {
          "gte": 2
        },
        "quantity": {
          "gte": 1
        },
        "paidInputs": true,
        "reconciled": true,
        "feesPaid": true,
        "fuelUsed": {
          "gte": 1
        }
      }
    },
    "count": 2,
    "distinctYears": 2
  },
  "AC7": {
    "type": "records",
    "match": {
      "kind": "production",
      "facts": {
        "item": {
          "oneOf": [
            "vessel",
            "decorated-vessel"
          ]
        },
        "quality": {
          "gte": 2
        },
        "quantity": {
          "gte": 1
        },
        "paidInputs": true,
        "reconciled": true,
        "inspectionAccepted": true,
        "contract": true
      }
    },
    "count": 2,
    "distinctYears": 2
  },
  "AC8": {
    "type": "records",
    "match": {
      "kind": "production",
      "facts": {
        "item": {
          "oneOf": [
            "vessel",
            "decorated-vessel"
          ]
        },
        "quality": {
          "gte": 3
        },
        "quantity": {
          "gte": 8
        },
        "paidInputs": true,
        "reconciled": true
      }
    },
    "count": 2,
    "distinctYears": 2
  },
  "AC9": {
    "type": "records",
    "match": {
      "kind": "production",
      "facts": {
        "item": {
          "oneOf": [
            "vessel",
            "decorated-vessel"
          ]
        },
        "quality": {
          "gte": 3
        },
        "quantity": {
          "gte": 1
        },
        "paidInputs": true,
        "reconciled": true,
        "matchedSet": true,
        "contract": true,
        "deadlineMet": true
      }
    },
    "count": 2,
    "distinctYears": 2
  },
  "AC10": {
    "type": "records",
    "match": {
      "kind": "assessment",
      "actions": [
        "assess-AC10"
      ],
      "facts": {
        "registered": true,
        "accepted": true,
        "paidInputs": true,
        "feesPaid": true,
        "reconciled": true
      },
      "references": {
        "minimum": 2,
        "distinctYears": 2,
        "allMatch": {
          "kind": "production",
          "facts": {
            "item": "decorated-vessel",
            "quality": {
              "gte": 4
            },
            "paidInputs": true,
            "reconciled": true
          }
        },
        "matching": {
          "facts": {
            "matchedSet": true,
            "inspectionAccepted": true
          }
        },
        "minimumMatching": 1,
        "sum": {
          "fact": "quantity",
          "minimum": 12
        }
      }
    },
    "count": 1
  },
  "AS5": {
    "type": "all",
    "proofs": [
      {
        "type": "records",
        "match": {
          "kind": "production",
          "facts": {
            "item": {
              "oneOf": [
                "clay-model"
              ]
            },
            "quality": {
              "gte": 1
            },
            "quantity": {
              "gte": 1
            },
            "paidInputs": true,
            "reconciled": true
          }
        },
        "count": 1,
        "afterNode": "A4"
      },
      {
        "type": "records",
        "match": {
          "actions": [
            "wood-relief-practice"
          ],
          "facts": {
            "paidInputs": true
          }
        },
        "count": 1,
        "afterNode": "A4"
      }
    ]
  },
  "AS6": {
    "type": "records",
    "match": {
      "kind": "production",
      "facts": {
        "item": {
          "oneOf": [
            "small-relief"
          ]
        },
        "quality": {
          "gte": 2
        },
        "quantity": {
          "gte": 1
        },
        "paidInputs": true,
        "reconciled": true
      }
    },
    "count": 2,
    "distinctYears": 2
  },
  "AS7": {
    "type": "records",
    "match": {
      "kind": "production",
      "facts": {
        "item": {
          "oneOf": [
            "stone-figure"
          ]
        },
        "quality": {
          "gte": 2
        },
        "quantity": {
          "gte": 1
        },
        "paidInputs": true,
        "reconciled": true,
        "inspectionAccepted": true
      }
    },
    "count": 2,
    "distinctYears": 2
  },
  "AS8": {
    "type": "all",
    "proofs": [
      {
        "type": "records",
        "match": {
          "kind": "production",
          "facts": {
            "item": {
              "oneOf": [
                "bust"
              ]
            },
            "quality": {
              "gte": 3
            },
            "quantity": {
              "gte": 1
            },
            "paidInputs": true,
            "reconciled": true
          }
        },
        "count": 1
      },
      {
        "type": "records",
        "match": {
          "actions": [
            "project-budget"
          ],
          "facts": {
            "reconciled": true
          }
        },
        "count": 1
      }
    ]
  },
  "AS9": {
    "type": "records",
    "match": {
      "kind": "production",
      "facts": {
        "item": {
          "oneOf": [
            "large-relief"
          ]
        },
        "quality": {
          "gte": 3
        },
        "quantity": {
          "gte": 1
        },
        "paidInputs": true,
        "reconciled": true,
        "deadlineMet": true,
        "paymentRecorded": true
      }
    },
    "count": 1
  },
  "AS10": {
    "type": "records",
    "match": {
      "kind": "assessment",
      "actions": [
        "assess-AS10"
      ],
      "facts": {
        "registered": true,
        "accepted": true,
        "paidInputs": true,
        "feesPaid": true,
        "reconciled": true,
        "inspectionAccepted": true
      },
      "references": {
        "minimum": 2,
        "distinctYears": 2,
        "allMatch": {
          "kind": "production",
          "facts": {
            "item": "monument",
            "quality": {
              "gte": 4
            },
            "paidInputs": true,
            "reconciled": true
          }
        },
        "sum": {
          "fact": "quantity",
          "minimum": 1
        }
      }
    },
    "count": 1
  },
  "P1": {
    "type": "records",
    "match": {
      "kind": "exercise",
      "actions": [
        "guided-reading"
      ],
      "facts": {
        "questionRecorded": true,
        "evidenceRecorded": true
      }
    },
    "count": 1
  },
  "P2": {
    "type": "records",
    "match": {
      "kind": "exercise",
      "actions": [
        "argument-exercise"
      ],
      "facts": {
        "claimRecorded": true,
        "reasons": {
          "gte": 2
        },
        "counterargumentRecorded": true,
        "responseRecorded": true
      }
    },
    "count": 1
  },
  "P3": {
    "type": "records",
    "match": {
      "kind": "exercise",
      "actions": [
        "evidence-comparison"
      ],
      "facts": {
        "recordsCompared": {
          "gte": 2
        },
        "disagreementRecorded": true
      }
    },
    "count": 2,
    "distinctBy": "datasetId",
    "minimumDistinct": 2
  },
  "P4": {
    "type": "all",
    "proofs": [
      {
        "type": "records",
        "match": {
          "kind": "exercise",
          "actions": [
            "reviewed-inquiry"
          ],
          "facts": {
            "reviewAccepted": true
          }
        },
        "count": 1
      },
      {
        "type": "records",
        "match": {
          "kind": "exercise",
          "actions": [
            "public-dilemma"
          ],
          "facts": {
            "reasons": {
              "gte": 1
            },
            "evidenceRecorded": true
          }
        },
        "count": 1
      }
    ]
  },
  "PS5": {
    "type": "records",
    "match": {
      "kind": "exercise",
      "actions": [
        "observation-project"
      ],
      "facts": {
        "evidenceRecorded": true
      }
    },
    "count": 2,
    "distinctYears": 2,
    "distinctBy": "datasetId",
    "minimumDistinct": 2
  },
  "PS6": {
    "type": "records",
    "match": {
      "kind": "exercise",
      "actions": [
        "measurement-calculation"
      ],
      "facts": {
        "errorBps": {
          "gte": 0,
          "lte": 200
        },
        "calculationRetained": true
      }
    },
    "count": 2,
    "distinctYears": 2
  },
  "PS7": {
    "type": "records",
    "match": {
      "kind": "exercise",
      "actions": [
        "test-explanation"
      ],
      "facts": {
        "predictionDeclared": true,
        "resultCompared": true
      }
    },
    "count": 1
  },
  "PS8": {
    "type": "records",
    "match": {
      "kind": "exercise",
      "actions": [
        "independent-check"
      ],
      "facts": {
        "independentCheck": true,
        "errorBps": {
          "gte": 0,
          "lte": 200
        }
      }
    },
    "count": 2,
    "distinctYears": 2
  },
  "PS9": {
    "type": "records",
    "match": {
      "kind": "exercise",
      "actions": [
        "research-synthesis"
      ],
      "references": {
        "minimum": 3,
        "distinctYears": 2,
        "matching": {
          "facts": {
            "independentCheck": true
          }
        },
        "minimumMatching": 2
      }
    },
    "count": 1
  },
  "PS10": {
    "type": "records",
    "match": {
      "kind": "assessment",
      "actions": [
        "assess-PS10"
      ],
      "facts": {
        "registered": true,
        "accepted": true,
        "paidInputs": true,
        "feesPaid": true,
        "reconciled": true,
        "questionRecorded": true,
        "conclusionRecorded": true
      },
      "references": {
        "minimum": 2,
        "distinctYears": 2,
        "distinctBy": "datasetId",
        "minimumDistinct": 2,
        "matching": {
          "facts": {
            "independentCheck": true
          }
        },
        "minimumMatching": 1
      }
    },
    "count": 1
  },
  "PP5": {
    "type": "records",
    "match": {
      "kind": "exercise",
      "actions": [
        "public-address"
      ],
      "facts": {
        "factsCited": {
          "gte": 2
        },
        "tradeoffRecorded": true
      }
    },
    "count": 2,
    "distinctBy": "issueId",
    "minimumDistinct": 2
  },
  "PP6": {
    "type": "records",
    "match": {
      "kind": "exercise",
      "actions": [
        "negotiate-agreement"
      ],
      "facts": {
        "fundedPlan": true,
        "agreementSecured": true,
        "delivered": true
      }
    },
    "count": 2,
    "distinctYears": 2
  },
  "PP7": {
    "type": "records",
    "match": {
      "kind": "exercise",
      "actions": [
        "public-service"
      ],
      "facts": {
        "fundedPlan": true,
        "delivered": true,
        "reconciled": true
      },
      "references": {
        "minimum": 1,
        "matching": {
          "kind": "exercise",
          "actions": [
            "public-budget"
          ],
          "facts": {
            "reconciled": true
          }
        },
        "minimumMatching": 1
      }
    },
    "count": 1
  },
  "PP8": {
    "type": "records",
    "match": {
      "kind": "exercise",
      "actions": [
        "coalition-agreement"
      ],
      "facts": {
        "groupCount": {
          "gte": 2
        },
        "agreementSecured": true,
        "delivered": true
      }
    },
    "count": 2,
    "distinctYears": 2
  },
  "PP9": {
    "type": "records",
    "match": {
      "kind": "exercise",
      "actions": [
        "policy-project"
      ],
      "facts": {
        "costsDeclared": true,
        "groupCount": {
          "gte": 2
        },
        "followupRecorded": true,
        "resultCompared": true
      },
      "references": {
        "minimum": 2,
        "distinctYears": 2,
        "allMatch": {
          "actions": [
            "policy-work",
            "policy-project"
          ],
          "facts": {
            "workCompleted": true
          }
        }
      }
    },
    "count": 1
  },
  "PP10": {
    "type": "all",
    "proofs": [
      {
        "type": "records",
        "match": {
          "kind": "assessment",
          "actions": [
            "assess-PP10"
          ],
          "facts": {
            "registered": true,
            "accepted": true,
            "paidInputs": true,
            "feesPaid": true,
            "reconciled": true,
            "fundedPlan": true,
            "agreementSecured": true,
            "delivered": true
          },
          "references": {
            "minimum": 2,
            "distinctYears": 2,
            "allMatch": {
              "actions": [
                "public-service",
                "policy-work",
                "civic-assessment-work"
              ],
              "facts": {
                "workCompleted": true,
                "reconciled": true
              }
            }
          }
        },
        "count": 1
      },
      {
        "type": "context",
        "field": "reputation",
        "minimum": 60
      }
    ]
  },
  "T1": {
    "type": "any",
    "proofs": [
      {
        "type": "records",
        "match": {
          "actions": [
            "stock-counting",
            "stock-reconciliation"
          ],
          "facts": {
            "reconciled": true
          }
        },
        "count": 1
      },
      {
        "type": "records",
        "match": {
          "kind": "trade",
          "facts": {
            "quantity": {
              "gte": 1
            },
            "paymentRecorded": true,
            "reconciled": true
          }
        },
        "count": 1
      }
    ]
  },
  "T2": {
    "type": "records",
    "match": {
      "kind": "exercise",
      "actions": [
        "cost-basket"
      ],
      "facts": {
        "paidInputs": true,
        "reconciled": true
      }
    },
    "count": 1
  },
  "T3": {
    "type": "records",
    "match": {
      "kind": "exercise",
      "actions": [
        "price-comparison"
      ],
      "facts": {
        "quoteRecorded": true,
        "costRecorded": true
      }
    },
    "count": 3,
    "distinctYears": 2
  },
  "T4": {
    "type": "records",
    "match": {
      "actions": [
        "stock-reconciliation"
      ],
      "facts": {
        "reconciled": true
      }
    },
    "count": 2,
    "distinctYears": 2
  },
  "T5": {
    "type": "records",
    "match": {
      "kind": "exercise",
      "actions": [
        "supply-plan"
      ],
      "facts": {
        "paidInputs": true,
        "delivered": true,
        "reconciled": true
      }
    },
    "count": 2,
    "distinctYears": 2
  },
  "T6": {
    "type": "records",
    "match": {
      "kind": "contract",
      "actions": [
        "fixed-price-order"
      ],
      "facts": {
        "fundedPlan": true,
        "agreementSecured": true,
        "delivered": true,
        "paymentRecorded": true
      }
    },
    "count": 2,
    "distinctYears": 2
  },
  "T7": {
    "type": "records",
    "match": {
      "kind": "contract",
      "actions": [
        "delivery-order"
      ],
      "facts": {
        "deadlineMet": true,
        "feesPaid": true,
        "reconciled": true,
        "paymentRecorded": true
      }
    },
    "count": 2,
    "distinctYears": 2
  },
  "T8": {
    "type": "records",
    "match": {
      "kind": "exercise",
      "actions": [
        "trading-year"
      ],
      "facts": {
        "realizedMargin": {
          "gte": 0
        },
        "paymentRecorded": true,
        "stockReconciled": true
      }
    },
    "count": 2,
    "distinctYears": 2
  },
  "T9": {
    "type": "records",
    "match": {
      "kind": "contract",
      "actions": [
        "enterprise-contract"
      ],
      "facts": {
        "fundedPlan": true,
        "paidInputs": true,
        "feesPaid": true,
        "paymentRecorded": true,
        "stockReconciled": true,
        "supplierDebt": 0,
        "delivered": true
      }
    },
    "count": 2,
    "distinctYears": 2
  },
  "T10": {
    "type": "records",
    "match": {
      "kind": "assessment",
      "actions": [
        "assess-T10"
      ],
      "facts": {
        "registered": true,
        "accepted": true,
        "paidInputs": true,
        "feesPaid": true,
        "reconciled": true
      },
      "references": {
        "minimum": 2,
        "distinctYears": 2,
        "distinctBy": "buyerAccount",
        "minimumDistinct": 2,
        "allMatch": {
          "kind": "contract",
          "actions": [
            "fixed-price-order",
            "delivery-order",
            "enterprise-contract"
          ],
          "facts": {
            "fundedPlan": true,
            "delivered": true,
            "paymentRecorded": true,
            "reconciled": true
          }
        }
      }
    },
    "count": 1
  }
};

function freezeRules<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value)) freezeRules(child); }
  return value;
}

export const CAPABILITY_RULES: readonly CapabilityRule[] = freezeRules(design.nodes.map(node => ({
  id: node.id, depth: node.depth, title: node.title, branch: node.branch, specialization: node.specialization,
  prerequisites: { all: [...node.prerequisites.all] },
  minimumProficiency: Object.fromEntries(Object.entries(node.minimumProficiency).map(([id, value]) => [id, Number(value)])),
  ...("anyProficiency" in node && node.anyProficiency ? { anyProficiency: node.anyProficiency.map(group => Object.fromEntries(Object.entries(group).filter(([, value]) => value !== undefined).map(([id, value]) => [id, Number(value)]))) } : {}),
  proof: proofs[node.id], proofDescription: node.proof, rewardDescription: node.reward,
})));

const integer = (value: number, minimum = 0): boolean => Number.isSafeInteger(value) && value >= minimum;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

function validateMatch(match: CapabilityEvidenceTest): void {
  if (!match || typeof match !== "object") throw new Error("A capability evidence predicate must be an object.");
  if (match.kind && !["work", "production", "harvest", "exercise", "contract", "assessment", "trade", "reconciliation"].includes(match.kind)) throw new Error("Unknown capability evidence kind.");
  if (match.actions && (!Array.isArray(match.actions) || !match.actions.length || match.actions.some(id => typeof id !== "string" || !id))) throw new Error("Invalid capability action predicate.");
  for (const test of Object.values(match.facts ?? {})) {
    if (typeof test === "number" && !finite(test)) throw new Error("Capability predicates require finite values.");
    if (test && typeof test === "object") {
      if (!Object.keys(test).length) throw new Error("Empty capability fact comparison.");
      if (test.gte !== undefined && !finite(test.gte) || test.lte !== undefined && !finite(test.lte)) throw new Error("Invalid capability fact bound.");
      if (test.oneOf && (!Array.isArray(test.oneOf) || !test.oneOf.length)) throw new Error("Invalid capability fact alternatives.");
    }
  }
  for (const balance of match.balances ?? []) if (!balance.available || !balance.required.length || balance.required.some(term => !term.fact || term.bps !== undefined && !integer(term.bps))) throw new Error("Invalid capability balance predicate.");
  if (match.references) {
    const refs = match.references;
    if (!integer(refs.minimum, 1) || refs.distinctYears !== undefined && !integer(refs.distinctYears, 1) || refs.minimumDistinct !== undefined && !integer(refs.minimumDistinct, 1) || refs.minimumMatching !== undefined && !integer(refs.minimumMatching, 1)) throw new Error("Invalid referenced capability proof count.");
    if (refs.matching) validateMatch(refs.matching);
    if (refs.allMatch) validateMatch(refs.allMatch);
    if (refs.sum && (!refs.sum.fact || !finite(refs.sum.minimum) || refs.sum.minimum < 0)) throw new Error("Invalid referenced capability total.");
  }
}

function validateProof(proof: CapabilityProof, ids: Set<string>, anchors: Set<string>): void {
  if (!proof || typeof proof !== "object") throw new Error("A capability needs an explicit proof rule.");
  if (proof.type === "all" || proof.type === "any") {
    if (!Array.isArray(proof.proofs) || !proof.proofs.length) throw new Error("Empty capability proof group.");
    for (const child of proof.proofs) validateProof(child, ids, anchors);
  } else if (proof.type === "context") {
    if (proof.field !== "reputation" || !finite(proof.minimum)) throw new Error("Unknown capability context gate.");
  } else if (proof.type === "records") {
    if (!integer(proof.count, 1) || proof.distinctYears !== undefined && !integer(proof.distinctYears, 1) || proof.minimumDistinct !== undefined && !integer(proof.minimumDistinct, 1) || proof.consecutiveYears !== undefined && !integer(proof.consecutiveYears, 1)) throw new Error("Invalid capability proof count.");
    if (proof.afterNode && (!ids.has(proof.afterNode) || !anchors.has(proof.afterNode))) throw new Error(`Invalid or deadlocked capability proof anchor: ${proof.afterNode}`);
    if (proof.sum && (!proof.sum.fact || !finite(proof.sum.minimum) || proof.sum.minimum < 0)) throw new Error("Invalid capability proof total.");
    validateMatch(proof.match);
  } else throw new Error("Unknown capability proof rule.");
}

/** Validate a frozen pack's own graph rather than silently substituting the current source rules. */
export function validateCapabilityRules(rules: readonly CapabilityRule[], skillIds?: Iterable<string>): void {
  if (!Array.isArray(rules) || !rules.length) throw new Error("A capability tree needs rules.");
  const ids = new Set<string>(), skills = skillIds ? new Set(skillIds) : null;
  for (const rule of rules) {
    if (!rule || typeof rule.id !== "string" || !rule.id || ids.has(rule.id)) throw new Error("Capability ids must be nonempty and unique.");
    ids.add(rule.id);
    if (!integer(rule.depth, 1) || !rule.title || !rule.branch || !rule.prerequisites || !Array.isArray(rule.prerequisites.all)) throw new Error(`Invalid capability metadata: ${rule.id}`);
    const groups = [rule.minimumProficiency, ...(rule.anyProficiency ?? [])];
    for (const requirements of groups) {
      if (!requirements || typeof requirements !== "object") throw new Error(`Invalid capability proficiency gates: ${rule.id}`);
      for (const [id, value] of Object.entries(requirements)) if (skills && !skills.has(id) || !finite(value) || value < 0 || value > 100) throw new Error(`Invalid capability proficiency: ${rule.id}/${id}`);
    }
  }
  const byId = new Map(rules.map(rule => [rule.id, rule]));
  for (const rule of rules) {
    if (new Set(rule.prerequisites.all).size !== rule.prerequisites.all.length) throw new Error(`Duplicate capability prerequisite: ${rule.id}`);
    for (const id of rule.prerequisites.all) if (!ids.has(id) || byId.get(id)!.depth >= rule.depth) throw new Error(`Invalid or cyclic capability prerequisite: ${rule.id}/${id}`);
    const expectedDepth = rule.prerequisites.all.length ? 1 + Math.max(...rule.prerequisites.all.map((id: string) => byId.get(id)!.depth)) : 1;
    if (rule.depth !== expectedDepth) throw new Error(`Capability depth does not match its prerequisites: ${rule.id}`);
    const ancestors = new Set<string>();
    const visit = (id: string): void => { for (const parent of byId.get(id)!.prerequisites.all) if (!ancestors.has(parent)) { ancestors.add(parent); visit(parent); } };
    visit(rule.id);
    validateProof(rule.proof, ids, ancestors);
  }
}
validateCapabilityRules(CAPABILITY_RULES);
