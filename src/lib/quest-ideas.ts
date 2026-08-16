export type QuestIdeaCategory =
  | "Skills & Learning"
  | "Creative & Technical"
  | "Adventure & Travel"
  | "Health & Fitness"
  | "Money & Career"
  | "Relationships & Community";

export interface QuestIdea {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  coinReward: number;
  category: QuestIdeaCategory;
}

export const QUEST_IDEA_CATEGORIES: QuestIdeaCategory[] = [
  "Skills & Learning",
  "Creative & Technical",
  "Adventure & Travel",
  "Health & Fitness",
  "Money & Career",
  "Relationships & Community",
];

export const QUEST_IDEAS: QuestIdea[] = [
  // Skills & Learning
  {
    id: "learn-100-words",
    title: "Learn 100 words in a new language",
    description: "Pick a language you've always wanted to learn and memorize 100 essential words to kickstart your vocabulary.",
    xpReward: 100,
    coinReward: 40,
    category: "Skills & Learning",
  },
  {
    id: "hold-a-conversation",
    title: "Hold a 5-minute conversation in a new language",
    description: "Put your vocabulary to the test with a real conversation, in person or with a language partner app.",
    xpReward: 200,
    coinReward: 80,
    category: "Skills & Learning",
  },
  {
    id: "read-outside-genre",
    title: "Read a full book outside your usual genre",
    description: "Step out of your comfort zone and finish a book in a genre you rarely pick up.",
    xpReward: 150,
    coinReward: 60,
    category: "Skills & Learning",
  },
  {
    id: "cook-5-new-recipes",
    title: "Learn to cook 5 new recipes from scratch",
    description: "Build real cooking skills by making five recipes you've never tried before, from scratch.",
    xpReward: 175,
    coinReward: 70,
    category: "Skills & Learning",
  },
  {
    id: "finish-online-course",
    title: "Take a free online course and finish it",
    description: "Pick a topic you're curious about and complete a free course from start to finish.",
    xpReward: 200,
    coinReward: 90,
    category: "Skills & Learning",
  },

  // Creative & Technical
  {
    id: "build-personal-website",
    title: "Build and publish a personal website",
    description: "Design and launch a simple website of your own, whether it's a portfolio, blog, or landing page.",
    xpReward: 350,
    coinReward: 150,
    category: "Creative & Technical",
  },
  {
    id: "write-short-story",
    title: "Write and finish a short story",
    description: "Start and complete an original short story, start to end, no matter how short.",
    xpReward: 200,
    coinReward: 80,
    category: "Creative & Technical",
  },
  {
    id: "learn-instrument-basics",
    title: "Learn the basics of a musical instrument",
    description: "Pick up an instrument and learn to play a simple song or a few basic chords.",
    xpReward: 250,
    coinReward: 100,
    category: "Creative & Technical",
  },
  {
    id: "create-piece-of-art",
    title: "Create a piece of art you're proud of",
    description: "Make a drawing, painting, or digital artwork you'd actually want to show someone.",
    xpReward: 150,
    coinReward: 60,
    category: "Creative & Technical",
  },
  {
    id: "record-podcast-episode",
    title: "Record one episode of a podcast",
    description: "Pick a topic you know well and record a single episode, even if no one else ever hears it.",
    xpReward: 250,
    coinReward: 100,
    category: "Creative & Technical",
  },

  // Adventure & Travel
  {
    id: "weekend-road-trip",
    title: "Plan and go on a weekend road trip",
    description: "Pick a destination within driving distance and plan a getaway for the weekend.",
    xpReward: 300,
    coinReward: 125,
    category: "Adventure & Travel",
  },
  {
    id: "visit-new-city",
    title: "Visit a city you've never been to",
    description: "Explore a city that's new to you, even if it's just a few hours away.",
    xpReward: 250,
    coinReward: 100,
    category: "Adventure & Travel",
  },
  {
    id: "camp-for-a-night",
    title: "Go camping for a night",
    description: "Spend a night outdoors, whether it's a backyard tent or a real campsite.",
    xpReward: 200,
    coinReward: 80,
    category: "Adventure & Travel",
  },
  {
    id: "try-3-new-cuisines",
    title: "Try 3 new restaurants or cuisines you've never had",
    description: "Broaden your palate by trying three cuisines or restaurants that are completely new to you.",
    xpReward: 100,
    coinReward: 40,
    category: "Adventure & Travel",
  },
  {
    id: "solo-day-trip",
    title: "Take a solo day trip somewhere new",
    description: "Spend a day exploring a new place entirely on your own terms.",
    xpReward: 150,
    coinReward: 60,
    category: "Adventure & Travel",
  },

  // Health & Fitness
  {
    id: "complete-a-5k",
    title: "Complete a 5K (walk or jog)",
    description: "Train up and finish a 5K, at whatever pace feels right for you.",
    xpReward: 250,
    coinReward: 100,
    category: "Health & Fitness",
  },
  {
    id: "try-new-workout-class",
    title: "Try a new type of workout class",
    description: "Sign up for a workout style you've never tried, like yoga, boxing, or climbing.",
    xpReward: 100,
    coinReward: 40,
    category: "Health & Fitness",
  },
  {
    id: "homemade-meals-week",
    title: "Cook only home-made meals for a full week",
    description: "Skip takeout for a week and cook every meal yourself.",
    xpReward: 200,
    coinReward: 80,
    category: "Health & Fitness",
  },
  {
    id: "consistent-sleep-2-weeks",
    title: "Keep a consistent sleep schedule for 2 weeks",
    description: "Go to bed and wake up at the same time every day for two weeks straight.",
    xpReward: 175,
    coinReward: 70,
    category: "Health & Fitness",
  },
  {
    id: "digital-detox-weekend",
    title: "Do a full digital detox weekend",
    description: "Spend a weekend away from screens and social media.",
    xpReward: 150,
    coinReward: 60,
    category: "Health & Fitness",
  },

  // Money & Career
  {
    id: "monthly-budget",
    title: "Build a monthly budget and stick to it for a month",
    description: "Set up a real budget and track your spending against it for a full month.",
    xpReward: 200,
    coinReward: 80,
    category: "Money & Career",
  },
  {
    id: "learn-investing-basics",
    title: "Learn the basics of investing",
    description: "Learn the fundamentals of investing so you can make informed decisions with your money.",
    xpReward: 175,
    coinReward: 70,
    category: "Money & Career",
  },
  {
    id: "update-resume-linkedin",
    title: "Update your resume or LinkedIn and get feedback on it",
    description: "Refresh your resume or LinkedIn profile and ask someone you trust to review it.",
    xpReward: 100,
    coinReward: 40,
    category: "Money & Career",
  },
  {
    id: "start-side-project",
    title: "Start a small side project or side hustle",
    description: "Turn an idea into a real, small side project or side hustle you actually launch.",
    xpReward: 300,
    coinReward: 125,
    category: "Money & Career",
  },
  {
    id: "negotiate-something",
    title: "Negotiate something (salary, bill, or price)",
    description: "Practice negotiating in a real situation, whether it's a bill, a purchase, or your salary.",
    xpReward: 150,
    coinReward: 60,
    category: "Money & Career",
  },

  // Relationships & Community
  {
    id: "reconnect-old-friend",
    title: "Reconnect with an old friend you've lost touch with",
    description: "Reach out to someone you used to be close with and catch up.",
    xpReward: 100,
    coinReward: 40,
    category: "Relationships & Community",
  },
  {
    id: "volunteer-local-cause",
    title: "Volunteer for a local cause",
    description: "Give your time to a local organization or cause you care about.",
    xpReward: 200,
    coinReward: 80,
    category: "Relationships & Community",
  },
  {
    id: "host-dinner-game-night",
    title: "Host a dinner or game night for friends",
    description: "Bring people together by hosting a dinner or game night at your place.",
    xpReward: 150,
    coinReward: 60,
    category: "Relationships & Community",
  },
  {
    id: "write-heartfelt-letter",
    title: "Write a heartfelt letter or message to someone important",
    description: "Take the time to write something genuine and meaningful to someone who matters to you.",
    xpReward: 75,
    coinReward: 30,
    category: "Relationships & Community",
  },
  {
    id: "learn-family-story",
    title: "Learn something new about a family member's life story",
    description: "Sit down with a family member and learn a story or piece of their history you didn't know.",
    xpReward: 100,
    coinReward: 40,
    category: "Relationships & Community",
  },
];
