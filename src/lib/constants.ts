export const STATE_TIMEZONES: Record<string, string> = {
  AL: "America/Chicago",
  AK: "America/Anchorage",
  AZ: "America/Phoenix",
  AR: "America/Chicago",
  CA: "America/Los_Angeles",
  CO: "America/Denver",
  CT: "America/New_York",
  DE: "America/New_York",
  FL: "America/New_York",
  GA: "America/New_York",
  HI: "Pacific/Honolulu",
  ID: "America/Boise",
  IL: "America/Chicago",
  IN: "America/Indiana/Indianapolis",
  IA: "America/Chicago",
  KS: "America/Chicago",
  KY: "America/New_York",
  LA: "America/Chicago",
  ME: "America/New_York",
  MD: "America/New_York",
  MA: "America/New_York",
  MI: "America/New_York",
  MN: "America/Chicago",
  MS: "America/Chicago",
  MO: "America/Chicago",
  MT: "America/Denver",
  NE: "America/Chicago",
  NV: "America/Los_Angeles",
  NH: "America/New_York",
  NJ: "America/New_York",
  NM: "America/Denver",
  NY: "America/New_York",
  NC: "America/New_York",
  ND: "America/Chicago",
  OH: "America/New_York",
  OK: "America/Chicago",
  OR: "America/Los_Angeles",
  PA: "America/New_York",
  RI: "America/New_York",
  SC: "America/New_York",
  SD: "America/Chicago",
  TN: "America/Chicago",
  TX: "America/Chicago",
  UT: "America/Denver",
  VT: "America/New_York",
  VA: "America/New_York",
  WA: "America/Los_Angeles",
  WV: "America/New_York",
  WI: "America/Chicago",
  WY: "America/Denver",
  DC: "America/New_York",
};

export const TIMEZONE_LABELS: Record<string, string> = {
  "America/New_York": "ET",
  "America/Chicago": "CT",
  "America/Denver": "MT",
  "America/Phoenix": "MT",
  "America/Los_Angeles": "PT",
  "America/Anchorage": "AKT",
  "Pacific/Honolulu": "HT",
};

export const TEMPLATE_KEYS = {
  INTRO: [
    { subject: "email_template_intro_v1_subject", body: "email_template_intro_v1_body" },
    { subject: "email_template_intro_v2_subject", body: "email_template_intro_v2_body" },
    { subject: "email_template_intro_v3_subject", body: "email_template_intro_v3_body" },
  ],
  SHOWREELS: [
    { subject: "email_template_showreels_v1_subject", body: "email_template_showreels_v1_body" },
    { subject: "email_template_showreels_v2_subject", body: "email_template_showreels_v2_body" },
    { subject: "email_template_showreels_v3_subject", body: "email_template_showreels_v3_body" },
  ],
  CURTAIN_CALL: [
    { subject: "email_template_curtain_call_v1_subject", body: "email_template_curtain_call_v1_body" },
    { subject: "email_template_curtain_call_v2_subject", body: "email_template_curtain_call_v2_body" },
    { subject: "email_template_curtain_call_v3_subject", body: "email_template_curtain_call_v3_body" },
  ],
  SIGNATURES: {
    indigo: "email_signature_indigo",
    rose: "email_signature_rose",
  }
};

export const DEFAULT_TEMPLATES = {
  INTRO: [
    { 
      subject: "Introducing Trickery — Your animation partner", 
      body: "I'd love to introduce our studio, Trickery. We specialize in high-end animation and visual storytelling." 
    },
    { 
      subject: "Quick intro: Trickery Animation", 
      body: "Came across your work and wanted to introduce Trickery. We help studios bring complex ideas to life through movement." 
    },
    { 
      subject: "Animation partner for your next project?", 
      body: "I'm reaching out from Trickery. We've been doing some interesting work in the animation space and thought we'd be a good fit for your team." 
    },
  ],
  SHOWREELS: [
    { 
      subject: "Trickery — A look at our latest work", 
      body: "I thought you might appreciate a look at our latest work and some of the projects we've been pushing lately." 
    },
    { 
      subject: "Recent projects from our studio", 
      body: "Wanted to share a few recent pieces we've finished at Trickery. We're really proud of the technical direction on these." 
    },
    { 
      subject: "Visual storytelling: Our latest reel", 
      body: "Here is a quick look at what we've been up to lately. We've been experimenting with some new styles you might find interesting." 
    },
  ],
  CURTAIN_CALL: [
    { 
      subject: "One last thought from Trickery", 
      body: "Just checking in one last time to see if you had any thoughts on our previous notes. Would love to connect when you have a moment." 
    },
    { 
      subject: "Checking in: Trickery", 
      body: "Hope you're having a great week. Just wanted to follow up one last time before I take this off my list. Would love to chat if the timing is right." 
    },
    { 
      subject: "Final follow up / Trickery", 
      body: "Wanted to send one last note to see if there's any interest in a quick intro call. If not, no worries at all!" 
    },
  ],
  SIGNATURES: {
    indigo: "\nWerner Burger\nTrickery\n\n+27 73 252 8362\nwww.trickery.co.za\n\n---\nThis email and any attachments are confidential and intended solely for the use of the individual or entity to whom it is addressed. If you have received this email in error, please notify Trickery and delete this message from your system.",
    rose: "\nLouis Minnaar\nTrickery\n\n+27 82 575 6333\nwww.trickery.co.za\n\n---\nThis email and any attachments are confidential and intended solely for the use of the individual or entity to whom it is addressed. If you have received this email in error, please notify Trickery and delete this message from your system.",
  }
};
