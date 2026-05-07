// src/data/faq.ts

export interface Faq {
  question: string;
  answer: string;
}

export const faqs: Faq[] = [
  {
    question: "What is Let's Flamingo?",
    answer:
      "It is a Solana web3 casual game and NFT collection. Anyone can play it and collect it.",
  },
  {
    question: "How does the ranking work?",
    answer:
      "The ranking freezes each Saturday. During that day, the top 10 players can claim free flamingo NFTs. The ranking resets after that and starts all over again.",
  },
  {
    question: "How do I know if I won?",
    answer:
      "If you show up in the ranking by Saturday, you will see the CLAIM button to FREE MINT.",
  },
  {
    question: "Are there plans for the future of this project?",
    answer:
      "We are the creatives behind The Puzzle Bros, and indie game development studio making passion projects that will hopefully entertain you. By supporting this project, you spark a chance for our projects to become possible.",
  },
  {
    question: "What else can I know about the collection?",
    answer:
      "Let's Flamingo! is a Metaplex Core collection, which ensures world class security and efficiency. The collection is already listed by Magic Eden and Tensor.",
  },
  {
    question: "How is my wallet used by this app?",
    answer:
      "Your wallet is kept private and safe. Its only purpose is recording your score in the ranking and allowing you to FREE MINT if you win. Ranking data is cleared every week and is not collected or used anywhere after that.",
  },
];
