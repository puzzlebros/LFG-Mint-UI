// src/data/faq.ts

export interface Faq {
  question: string;
  answer: string;
}

export const faqs: Faq[] = [
  {
    question: "What is Let's Flamingo?",
    answer:
      "It is a game and NFT collection. Anyone can play it and collect it.",
  },
  {
    question: "How are the game and collection related?",
    answer:
      "You can connect your wallet and play the game to record your high score. Weekly winners can claim a FREE MINT.",
  },
  {
    question: "How does the ranking work?",
    answer:
      "The ranking freezes each Saturday. During that day, the top 10 players can claim their NFT. The ranking resets after that and starts all over again.",
  },
  {
    question: "How do I know if I won?",
    answer:
      "If you show up in the ranking by Saturday, you will see the CLAIM button for your FREE MINT.",
  },
  {
    question: "How many times can I win?",
    answer:
      "Until the supply lasts, any week in which you rank in the top 10 by Saturday, you are eligible for a free mint.",
  },
  {
    question: "Why does this project exist?",
    answer:
      "We are a very small team of creatives and indie devs that love making games. With your support we can make and give you exclusive access as we grow together.",
  },
  {
    question: "Is this a scam?",
    answer:
      "No, we are game developers, art directors, artists and designers with based backgrounds wanting to adopt the web3 space as a way to connect with people interested in art, design and games.",
  },
  {
    question: "Are you doxxed?",
    answer:
      "No, but if you hop into the Discord we can know each other and plan for the future together.",
  },
  {
    question: "What else can I know about the collection?",
    answer:
      "Let's Flamingo! is a Metaplex Core collection, which ensures world class security and efficiency.",
  },
  {
    question: "How is my wallet used by this app?",
    answer:
      "Your wallet is kept private and safe. Its only purpose is recording your score in the ranking and allowing you to FREE MINT if you win. Ranking data is cleared every week and is not collected or used anywhere after that.",
  },
];
