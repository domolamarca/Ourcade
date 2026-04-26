// Local question bank for the TRIVIA cabinet. Original wordings — no
// scraped or copied content. Mix of categories so each run feels
// varied. Wire to OpenTriviaDB at runtime later for fresh rotations;
// this set is enough to support an infinite-mode arcade run.

export type TriviaCategory =
  | 'GENERAL'
  | 'SCIENCE'
  | 'HISTORY'
  | 'GEOGRAPHY'
  | 'POP CULTURE'
  | 'SPORTS';

export type TriviaQuestion = {
  id: string;
  category: TriviaCategory;
  question: string;
  /** Index into `choices` of the correct answer. */
  correctIdx: number;
  choices: string[];
};

export const TRIVIA_QUESTIONS: TriviaQuestion[] = [
  // GENERAL
  { id: 'g1', category: 'GENERAL', question: 'How many continents are there?', correctIdx: 1, choices: ['5', '7', '6', '8'] },
  { id: 'g2', category: 'GENERAL', question: 'Which color do you get by mixing blue and yellow?', correctIdx: 2, choices: ['Purple', 'Orange', 'Green', 'Brown'] },
  { id: 'g3', category: 'GENERAL', question: 'How many sides does a hexagon have?', correctIdx: 0, choices: ['6', '5', '7', '8'] },
  { id: 'g4', category: 'GENERAL', question: 'What is the largest mammal on Earth?', correctIdx: 3, choices: ['African elephant', 'Giraffe', 'Polar bear', 'Blue whale'] },
  { id: 'g5', category: 'GENERAL', question: 'Which is the only planet in our solar system that rotates clockwise?', correctIdx: 1, choices: ['Mars', 'Venus', 'Mercury', 'Jupiter'] },
  { id: 'g6', category: 'GENERAL', question: 'How many strings does a standard violin have?', correctIdx: 0, choices: ['4', '5', '6', '7'] },
  { id: 'g7', category: 'GENERAL', question: 'Which language has the most native speakers worldwide?', correctIdx: 2, choices: ['English', 'Spanish', 'Mandarin Chinese', 'Hindi'] },
  { id: 'g8', category: 'GENERAL', question: 'How many minutes are in a full day?', correctIdx: 1, choices: ['1,200', '1,440', '2,000', '720'] },
  { id: 'g9', category: 'GENERAL', question: 'What is the most common blood type in humans?', correctIdx: 0, choices: ['O+', 'A+', 'B+', 'AB+'] },
  { id: 'g10', category: 'GENERAL', question: 'What is the only mammal capable of true flight?', correctIdx: 1, choices: ['Flying squirrel', 'Bat', 'Sugar glider', 'Colugo'] },
  { id: 'g11', category: 'GENERAL', question: 'Which is the smallest U.S. state by area?', correctIdx: 2, choices: ['Delaware', 'Connecticut', 'Rhode Island', 'Vermont'] },
  { id: 'g12', category: 'GENERAL', question: 'What does the "www" stand for in a website URL?', correctIdx: 3, choices: ['World Web Wire', 'Wide Web World', 'Web Wide Web', 'World Wide Web'] },

  // SCIENCE
  { id: 's1', category: 'SCIENCE', question: 'What is the chemical symbol for gold?', correctIdx: 2, choices: ['Go', 'Gd', 'Au', 'Ag'] },
  { id: 's2', category: 'SCIENCE', question: 'Roughly how many bones are in the adult human body?', correctIdx: 1, choices: ['156', '206', '256', '300'] },
  { id: 's3', category: 'SCIENCE', question: 'What gas do plants primarily absorb from the atmosphere?', correctIdx: 0, choices: ['Carbon dioxide', 'Oxygen', 'Nitrogen', 'Hydrogen'] },
  { id: 's4', category: 'SCIENCE', question: 'At what temperature in Celsius does water freeze at sea level?', correctIdx: 2, choices: ['-32°', '32°', '0°', '100°'] },
  { id: 's5', category: 'SCIENCE', question: 'What does DNA stand for?', correctIdx: 1, choices: ['Direct Nuclear Acid', 'Deoxyribonucleic Acid', 'Diphosphoryl Acid', 'Distinct Nucleic Acid'] },
  { id: 's6', category: 'SCIENCE', question: 'The speed of light is approximately:', correctIdx: 3, choices: ['3 km/sec', '3,000 km/sec', '30,000 km/sec', '300,000 km/sec'] },
  { id: 's7', category: 'SCIENCE', question: 'Which planet is known as the Red Planet?', correctIdx: 1, choices: ['Jupiter', 'Mars', 'Venus', 'Mercury'] },
  { id: 's8', category: 'SCIENCE', question: 'How many chambers does the human heart have?', correctIdx: 2, choices: ['2', '3', '4', '6'] },
  { id: 's9', category: 'SCIENCE', question: 'What is the hardest naturally occurring substance on Earth?', correctIdx: 0, choices: ['Diamond', 'Quartz', 'Granite', 'Steel'] },
  { id: 's10', category: 'SCIENCE', question: 'Which subatomic particle has a positive charge?', correctIdx: 1, choices: ['Electron', 'Proton', 'Neutron', 'Photon'] },
  { id: 's11', category: 'SCIENCE', question: 'Which scientist developed the theory of general relativity?', correctIdx: 3, choices: ['Newton', 'Bohr', 'Curie', 'Einstein'] },
  { id: 's12', category: 'SCIENCE', question: 'What is the chemical symbol for sodium?', correctIdx: 2, choices: ['So', 'Sn', 'Na', 'S'] },
  { id: 's13', category: 'SCIENCE', question: 'Which organ filters blood in the human body?', correctIdx: 0, choices: ['Kidney', 'Pancreas', 'Spleen', 'Stomach'] },
  { id: 's14', category: 'SCIENCE', question: 'How long does it take Earth to orbit the Sun?', correctIdx: 1, choices: ['24 hours', '365.25 days', '30 days', '12 weeks'] },

  // HISTORY
  { id: 'h1', category: 'HISTORY', question: 'In what year did World War II end?', correctIdx: 2, choices: ['1939', '1942', '1945', '1948'] },
  { id: 'h2', category: 'HISTORY', question: 'Who painted the Mona Lisa?', correctIdx: 0, choices: ['Leonardo da Vinci', 'Michelangelo', 'Raphael', 'Donatello'] },
  { id: 'h3', category: 'HISTORY', question: 'Which empire built Machu Picchu?', correctIdx: 1, choices: ['Aztec', 'Inca', 'Maya', 'Olmec'] },
  { id: 'h4', category: 'HISTORY', question: 'The Great Wall of China was primarily built to keep out which group?', correctIdx: 2, choices: ['Russians', 'Japanese', 'Mongols', 'Persians'] },
  { id: 'h5', category: 'HISTORY', question: 'In which year did humans first walk on the Moon?', correctIdx: 1, choices: ['1965', '1969', '1972', '1975'] },
  { id: 'h6', category: 'HISTORY', question: 'Who was the first President of the United States?', correctIdx: 0, choices: ['George Washington', 'John Adams', 'Thomas Jefferson', 'James Madison'] },
  { id: 'h7', category: 'HISTORY', question: 'The Berlin Wall fell in which year?', correctIdx: 2, choices: ['1979', '1985', '1989', '1991'] },
  { id: 'h8', category: 'HISTORY', question: 'Which ancient civilization built the pyramids at Giza?', correctIdx: 1, choices: ['Romans', 'Egyptians', 'Greeks', 'Babylonians'] },
  { id: 'h9', category: 'HISTORY', question: 'Who wrote the Communist Manifesto with Friedrich Engels?', correctIdx: 3, choices: ['Lenin', 'Stalin', 'Trotsky', 'Karl Marx'] },
  { id: 'h10', category: 'HISTORY', question: 'The American Civil War ended in what year?', correctIdx: 0, choices: ['1865', '1860', '1870', '1855'] },
  { id: 'h11', category: 'HISTORY', question: 'Which king signed the Magna Carta in 1215?', correctIdx: 2, choices: ['Henry VIII', 'Richard the Lionheart', 'John', 'Edward I'] },
  { id: 'h12', category: 'HISTORY', question: 'The Roman Empire fell in approximately which year?', correctIdx: 1, choices: ['376 AD', '476 AD', '576 AD', '276 AD'] },

  // GEOGRAPHY
  { id: 'gg1', category: 'GEOGRAPHY', question: 'What is the longest river in the world?', correctIdx: 0, choices: ['Nile', 'Amazon', 'Mississippi', 'Yangtze'] },
  { id: 'gg2', category: 'GEOGRAPHY', question: 'Which country has the most natural lakes?', correctIdx: 2, choices: ['United States', 'Russia', 'Canada', 'Brazil'] },
  { id: 'gg3', category: 'GEOGRAPHY', question: 'What is the capital of Australia?', correctIdx: 3, choices: ['Sydney', 'Melbourne', 'Brisbane', 'Canberra'] },
  { id: 'gg4', category: 'GEOGRAPHY', question: 'Which ocean is the largest by surface area?', correctIdx: 1, choices: ['Atlantic', 'Pacific', 'Indian', 'Arctic'] },
  { id: 'gg5', category: 'GEOGRAPHY', question: 'Mount Everest sits on the border between Nepal and which other country?', correctIdx: 0, choices: ['China', 'India', 'Bhutan', 'Pakistan'] },
  { id: 'gg6', category: 'GEOGRAPHY', question: 'The Amazon rainforest is mostly located in which country?', correctIdx: 2, choices: ['Peru', 'Colombia', 'Brazil', 'Venezuela'] },
  { id: 'gg7', category: 'GEOGRAPHY', question: 'Which desert is the largest hot desert in the world?', correctIdx: 1, choices: ['Gobi', 'Sahara', 'Kalahari', 'Atacama'] },
  { id: 'gg8', category: 'GEOGRAPHY', question: 'What is the smallest country in the world by area?', correctIdx: 3, choices: ['Monaco', 'San Marino', 'Liechtenstein', 'Vatican City'] },
  { id: 'gg9', category: 'GEOGRAPHY', question: 'The Great Barrier Reef is located off the coast of which country?', correctIdx: 0, choices: ['Australia', 'New Zealand', 'Indonesia', 'Philippines'] },
  { id: 'gg10', category: 'GEOGRAPHY', question: 'What is the capital of Canada?', correctIdx: 2, choices: ['Toronto', 'Vancouver', 'Ottawa', 'Montreal'] },
  { id: 'gg11', category: 'GEOGRAPHY', question: 'Which European capital sits on the Seine?', correctIdx: 1, choices: ['London', 'Paris', 'Vienna', 'Berlin'] },
  { id: 'gg12', category: 'GEOGRAPHY', question: 'How many time zones does Russia span?', correctIdx: 2, choices: ['7', '9', '11', '13'] },

  // POP CULTURE
  { id: 'p1', category: 'POP CULTURE', question: 'Which band released the album "The Dark Side of the Moon"?', correctIdx: 2, choices: ['The Beatles', 'Led Zeppelin', 'Pink Floyd', 'The Rolling Stones'] },
  { id: 'p2', category: 'POP CULTURE', question: 'Who directed the original "Jaws" (1975)?', correctIdx: 0, choices: ['Steven Spielberg', 'George Lucas', 'Francis Ford Coppola', 'Ridley Scott'] },
  { id: 'p3', category: 'POP CULTURE', question: 'In "The Matrix", which pill does Neo take?', correctIdx: 1, choices: ['Blue', 'Red', 'Green', 'Yellow'] },
  { id: 'p4', category: 'POP CULTURE', question: 'Which video game franchise features a plumber named Mario?', correctIdx: 3, choices: ['Sonic', 'Zelda', 'Metroid', 'Super Mario'] },
  { id: 'p5', category: 'POP CULTURE', question: 'Who painted "Starry Night"?', correctIdx: 2, choices: ['Pablo Picasso', 'Claude Monet', 'Vincent van Gogh', 'Salvador Dalí'] },
  { id: 'p6', category: 'POP CULTURE', question: 'Which actor played Iron Man in the Marvel Cinematic Universe?', correctIdx: 0, choices: ['Robert Downey Jr.', 'Chris Evans', 'Mark Ruffalo', 'Chris Hemsworth'] },
  { id: 'p7', category: 'POP CULTURE', question: 'Who wrote the Harry Potter book series?', correctIdx: 1, choices: ['Stephen King', 'J.K. Rowling', 'Neil Gaiman', 'Rick Riordan'] },
  { id: 'p8', category: 'POP CULTURE', question: 'Which artist released the song "Like a Rolling Stone" in 1965?', correctIdx: 2, choices: ['Elvis Presley', 'Johnny Cash', 'Bob Dylan', 'Buddy Holly'] },
  { id: 'p9', category: 'POP CULTURE', question: 'What is the name of the wizard school in Harry Potter?', correctIdx: 3, choices: ['Beauxbatons', 'Durmstrang', 'Ilvermorny', 'Hogwarts'] },
  { id: 'p10', category: 'POP CULTURE', question: 'Which company created the iPhone?', correctIdx: 0, choices: ['Apple', 'Samsung', 'Google', 'Sony'] },
  { id: 'p11', category: 'POP CULTURE', question: 'What animated film features a clownfish named Marlin searching for his son?', correctIdx: 1, choices: ['Shark Tale', 'Finding Nemo', 'The Little Mermaid', 'Moana'] },
  { id: 'p12', category: 'POP CULTURE', question: 'Which sitcom features the characters Jerry, George, Elaine, and Kramer?', correctIdx: 2, choices: ['Friends', 'Cheers', 'Seinfeld', 'Frasier'] },

  // SPORTS
  { id: 'sp1', category: 'SPORTS', question: 'How many players are on a standard basketball team on the court?', correctIdx: 1, choices: ['4', '5', '6', '7'] },
  { id: 'sp2', category: 'SPORTS', question: 'In which sport would you score a "hat trick"?', correctIdx: 2, choices: ['Tennis', 'Baseball', 'Hockey', 'Golf'] },
  { id: 'sp3', category: 'SPORTS', question: 'How often are the Summer Olympic Games held?', correctIdx: 1, choices: ['Every 2 years', 'Every 4 years', 'Every 5 years', 'Every 10 years'] },
  { id: 'sp4', category: 'SPORTS', question: 'In which country did the sport of judo originate?', correctIdx: 0, choices: ['Japan', 'China', 'South Korea', 'Brazil'] },
  { id: 'sp5', category: 'SPORTS', question: 'What is the maximum break possible in a single frame of snooker?', correctIdx: 3, choices: ['100', '127', '149', '147'] },
  { id: 'sp6', category: 'SPORTS', question: 'Which sport is sometimes called "the sweet science"?', correctIdx: 1, choices: ['Fencing', 'Boxing', 'Wrestling', 'MMA'] },
  { id: 'sp7', category: 'SPORTS', question: 'How many holes are played in a standard round of golf?', correctIdx: 2, choices: ['9', '12', '18', '24'] },
  { id: 'sp8', category: 'SPORTS', question: 'In tennis, what is the term for a score of zero?', correctIdx: 0, choices: ['Love', 'Nil', 'Goose', 'Blank'] },
  { id: 'sp9', category: 'SPORTS', question: 'Which country won the first FIFA Men\'s World Cup in 1930?', correctIdx: 1, choices: ['Brazil', 'Uruguay', 'Argentina', 'Italy'] },
  { id: 'sp10', category: 'SPORTS', question: 'How many points is a touchdown worth in American football?', correctIdx: 2, choices: ['3', '5', '6', '7'] },
  { id: 'sp11', category: 'SPORTS', question: 'In baseball, how many strikes equal a strikeout?', correctIdx: 0, choices: ['3', '4', '2', '5'] },
  { id: 'sp12', category: 'SPORTS', question: 'Which Grand Slam tennis tournament is played on grass courts?', correctIdx: 3, choices: ['French Open', 'US Open', 'Australian Open', 'Wimbledon'] },
];

/** Returns N random questions, sampled without replacement. */
export function pickQuestions(count: number, seed?: number): TriviaQuestion[] {
  const pool = [...TRIVIA_QUESTIONS];
  const out: TriviaQuestion[] = [];
  let s = seed ?? Math.floor(Math.random() * 1e9);
  function next() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  }
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(next() * pool.length);
    out.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return out;
}

/**
 * Sequence generator for INFINITE-mode trivia. Lazily yields questions,
 * refilling the bag with a fresh shuffle whenever it empties so a long
 * run keeps producing variety without immediate repeats.
 */
export class TriviaSequence {
  private rng: () => number;
  private bag: TriviaQuestion[] = [];

  constructor(seed?: number) {
    let s = seed ?? Math.floor(Math.random() * 1e9);
    this.rng = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0x100000000;
    };
    this.refill();
  }

  private refill() {
    const pool = [...TRIVIA_QUESTIONS];
    const out: TriviaQuestion[] = [];
    while (pool.length > 0) {
      const idx = Math.floor(this.rng() * pool.length);
      out.push(pool[idx]);
      pool.splice(idx, 1);
    }
    // Avoid an immediate repeat across bag boundaries by rotating the
    // first card to the back if we just refilled.
    if (out.length > 1) {
      const first = out.shift()!;
      out.push(first);
    }
    this.bag = out;
  }

  next(): TriviaQuestion {
    if (this.bag.length === 0) this.refill();
    return this.bag.shift()!;
  }
}

export const TRIVIA_CATEGORIES: TriviaCategory[] = [
  'GENERAL',
  'SCIENCE',
  'HISTORY',
  'GEOGRAPHY',
  'POP CULTURE',
  'SPORTS',
];
