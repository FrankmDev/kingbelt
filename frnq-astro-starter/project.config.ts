export interface ProjectPage {
  name: string;
  path: `/${string}`;
  purpose: string;
  conversion: string;
  sections: string[];
}

export interface ProjectConfig {
  meta: {
    starterVersion: string;
    initialized: boolean;
    initializedAt: string | null;
  };
  identity: {
    projectName: string;
    companyName: string;
    domain: string;
    language: string;
    locale: string;
  };
  business: {
    sector: string;
    audience: string;
    primaryGoal: string;
    primaryConversion: string;
    services: string[];
    differentiators: string[];
  };
  design: {
    summary: string;
    referenceFiles: string[];
    layoutDirection: string;
    typographyDirection: string;
    colorDirection: string;
    imageDirection: string;
    motionDirection: string;
    avoid: string[];
  };
  pages: ProjectPage[];
  functionality: {
    required: string[];
    integrations: string[];
  };
}

export const projectConfig = {
  "meta": {
    "starterVersion": "1.0.0",
    "initialized": false,
    "initializedAt": null
  },
  "identity": {
    "projectName": "",
    "companyName": "",
    "domain": "",
    "language": "es",
    "locale": "es-ES"
  },
  "business": {
    "sector": "",
    "audience": "",
    "primaryGoal": "",
    "primaryConversion": "",
    "services": [],
    "differentiators": []
  },
  "design": {
    "summary": "",
    "referenceFiles": [],
    "layoutDirection": "",
    "typographyDirection": "",
    "colorDirection": "",
    "imageDirection": "",
    "motionDirection": "",
    "avoid": []
  },
  "pages": [
    {
      "name": "Home",
      "path": "/",
      "purpose": "",
      "conversion": "",
      "sections": []
    }
  ],
  "functionality": {
    "required": [],
    "integrations": []
  }
} satisfies ProjectConfig;
