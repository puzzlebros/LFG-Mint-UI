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
    question: "How are they game and the NFT related?",
    answer:
      "The game has a ranking. Every weekend, the top 10 can claim a free NFT from the collection.",
  },
  {
    question: "How does the ranking work?",
    answer:
      "The ranking freezes each Saturday. During that day, the top 10 players can claim their NFT. The ranking resets after that and starts all over again.",
  },
  {
    question: "How do I know if I won?",
    answer:
      "If you show up in the ranking while it is frozen, you will see the CLAIM button. Once you claim it, you are not eligible for a free NFT anymore.",
  },
  {
    question: "How many NFT of the collection can I have?",
    answer:
      "You can win only 1 NFT per wallet by playing the game. Then you can mint any amount you like at 0.1 fixed price per item.",
  },
  {
    question: "What is Solana?",
    answer:
      "Solana is one of the most recognized blockchains in the world. It is lightweight and has the strongest community.",
  },
  {
    question: "How do I collect it?",
    answer:
      "To mint means that you become the rightful owner of an item of the collection. You need a tiny bit of sol to cover for the network cost associated to that transaction that makes that possible.",
  },
  {
    question: "What else can I know about the collection?",
    answer:
      "The collection is a Metaplex Core NFT Standard, which ensures world class security and efficiency recognized by the biggest marketplaces such as Magic Eden and Tensor.",
  },
  {
    question: "How is my wallet used in this app?",
    answer:
      "Your wallet is not used by any commercial purpose and your account data is not collected ever by this app. Your connected wallet is perfectly safe and private, and it only serves the purpose of recording your score in the ranking to mint from the Metaplex Core collection. Ranking data is cleared every week and no wallet data is ever stored anywhere.",
  },
];
