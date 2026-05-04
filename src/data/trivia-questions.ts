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

  // ----- Expansion Pack 1 (+150) ------------------------------------------

  // GENERAL (25)
  { id: 'g13', category: 'GENERAL', question: 'How many sides does a stop sign have?', correctIdx: 2, choices: ['6', '7', '8', '10'] },
  { id: 'g14', category: 'GENERAL', question: 'Which animal appears on the Australian coat of arms beside the kangaroo?', correctIdx: 1, choices: ['Wombat', 'Emu', 'Koala', 'Platypus'] },
  { id: 'g15', category: 'GENERAL', question: 'How many degrees are in a right angle?', correctIdx: 0, choices: ['90', '180', '45', '60'] },
  { id: 'g16', category: 'GENERAL', question: 'Which letter does not appear in any U.S. state name?', correctIdx: 2, choices: ['J', 'X', 'Q', 'Z'] },
  { id: 'g17', category: 'GENERAL', question: 'How many ounces are in one pound?', correctIdx: 1, choices: ['12', '16', '20', '24'] },
  { id: 'g18', category: 'GENERAL', question: 'At what Fahrenheit temperature does water freeze at sea level?', correctIdx: 3, choices: ['0°', '16°', '40°', '32°'] },
  { id: 'g19', category: 'GENERAL', question: 'Which animal famously sleeps up to 22 hours a day?', correctIdx: 0, choices: ['Koala', 'Hedgehog', 'Sea otter', 'Owl'] },
  { id: 'g20', category: 'GENERAL', question: 'Which language is the most common second language worldwide?', correctIdx: 1, choices: ['French', 'English', 'Spanish', 'Arabic'] },
  { id: 'g21', category: 'GENERAL', question: 'How many keys are on a standard full-size piano?', correctIdx: 2, choices: ['76', '84', '88', '96'] },
  { id: 'g22', category: 'GENERAL', question: 'Which of these is NOT a primary additive color of light?', correctIdx: 3, choices: ['Red', 'Green', 'Blue', 'Yellow'] },
  { id: 'g23', category: 'GENERAL', question: 'How many stripes are on the U.S. flag?', correctIdx: 1, choices: ['12', '13', '15', '50'] },
  { id: 'g24', category: 'GENERAL', question: 'How many wonders are listed in the "New Seven Wonders of the World"?', correctIdx: 1, choices: ['5', '7', '9', '12'] },
  { id: 'g25', category: 'GENERAL', question: 'What is the largest organ of the human body?', correctIdx: 2, choices: ['Liver', 'Lungs', 'Skin', 'Brain'] },
  { id: 'g26', category: 'GENERAL', question: 'How many wheels does a unicycle have?', correctIdx: 0, choices: ['1', '2', '3', '4'] },
  { id: 'g27', category: 'GENERAL', question: 'Which is technically the tallest type of grass?', correctIdx: 3, choices: ['Wheat', 'Oats', 'Sugarcane', 'Bamboo'] },
  { id: 'g28', category: 'GENERAL', question: 'What is the official language of Brazil?', correctIdx: 2, choices: ['Spanish', 'English', 'Portuguese', 'French'] },
  { id: 'g29', category: 'GENERAL', question: 'How many feet are in one yard?', correctIdx: 1, choices: ['2', '3', '4', '6'] },
  { id: 'g30', category: 'GENERAL', question: 'What does "CPU" stand for in computing?', correctIdx: 0, choices: ['Central Processing Unit', 'Computer Power Unit', 'Core Program Utility', 'Central Program Unit'] },
  { id: 'g31', category: 'GENERAL', question: 'On which planet is a single day longer than a single year?', correctIdx: 2, choices: ['Mercury', 'Mars', 'Venus', 'Neptune'] },
  { id: 'g32', category: 'GENERAL', question: 'How many sides does a dodecagon have?', correctIdx: 3, choices: ['8', '10', '11', '12'] },
  { id: 'g33', category: 'GENERAL', question: 'After water, which is the most consumed beverage in the world?', correctIdx: 1, choices: ['Coffee', 'Tea', 'Beer', 'Soda'] },
  { id: 'g34', category: 'GENERAL', question: 'Which fruit famously has its seeds on the outside?', correctIdx: 2, choices: ['Kiwi', 'Pomegranate', 'Strawberry', 'Apple'] },
  { id: 'g35', category: 'GENERAL', question: 'What does "GPS" stand for?', correctIdx: 0, choices: ['Global Positioning System', 'Geographic Pinpoint Service', 'General Position Satellite', 'Global Path Sensor'] },
  { id: 'g36', category: 'GENERAL', question: 'How many planets are in our solar system?', correctIdx: 1, choices: ['7', '8', '9', '10'] },
  { id: 'g37', category: 'GENERAL', question: 'Which is the largest country in the world by land area?', correctIdx: 2, choices: ['United States', 'China', 'Russia', 'Canada'] },

  // SCIENCE (25)
  { id: 's15', category: 'SCIENCE', question: 'Which element has the chemical symbol Fe?', correctIdx: 1, choices: ['Fluorine', 'Iron', 'Lead', 'Calcium'] },
  { id: 's16', category: 'SCIENCE', question: 'What is the largest planet in our solar system?', correctIdx: 0, choices: ['Jupiter', 'Saturn', 'Neptune', 'Uranus'] },
  { id: 's17', category: 'SCIENCE', question: 'Which scientist formulated the three laws of motion?', correctIdx: 2, choices: ['Galileo', 'Kepler', 'Newton', 'Hawking'] },
  { id: 's18', category: 'SCIENCE', question: 'What is considered the smallest unit of life?', correctIdx: 3, choices: ['Atom', 'Molecule', 'Tissue', 'Cell'] },
  { id: 's19', category: 'SCIENCE', question: 'How many teeth does a typical adult human have (with wisdom teeth)?', correctIdx: 0, choices: ['32', '28', '24', '36'] },
  { id: 's20', category: 'SCIENCE', question: 'Which gas makes up most of Earth\'s atmosphere?', correctIdx: 1, choices: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Argon'] },
  { id: 's21', category: 'SCIENCE', question: 'What is the pH of pure water at 25°C?', correctIdx: 2, choices: ['1', '4', '7', '10'] },
  { id: 's22', category: 'SCIENCE', question: 'What does "mRNA" stand for?', correctIdx: 3, choices: ['Multiple RNA', 'Mature RNA', 'Mitochondrial RNA', 'Messenger RNA'] },
  { id: 's23', category: 'SCIENCE', question: 'Which type of blood cell primarily fights infection?', correctIdx: 0, choices: ['White blood cells', 'Red blood cells', 'Platelets', 'Plasma cells'] },
  { id: 's24', category: 'SCIENCE', question: 'At what Celsius temperature does water boil at sea level?', correctIdx: 1, choices: ['80°', '100°', '120°', '212°'] },
  { id: 's25', category: 'SCIENCE', question: 'The Richter scale measures the magnitude of what?', correctIdx: 2, choices: ['Wind speed', 'Sound', 'Earthquakes', 'Radiation'] },
  { id: 's26', category: 'SCIENCE', question: 'What does "LED" stand for?', correctIdx: 3, choices: ['Low Energy Display', 'Linear Electronic Diode', 'Lit Electric Disc', 'Light Emitting Diode'] },
  { id: 's27', category: 'SCIENCE', question: 'Which vitamin does the human body produce when exposed to sunlight?', correctIdx: 0, choices: ['Vitamin D', 'Vitamin C', 'Vitamin B12', 'Vitamin A'] },
  { id: 's28', category: 'SCIENCE', question: 'Roughly how fast does sound travel through dry air at 20°C?', correctIdx: 1, choices: ['100 m/s', '343 m/s', '700 m/s', '1,500 m/s'] },
  { id: 's29', category: 'SCIENCE', question: 'As of 2024, which planet has the most confirmed moons?', correctIdx: 2, choices: ['Jupiter', 'Neptune', 'Saturn', 'Uranus'] },
  { id: 's30', category: 'SCIENCE', question: 'Which is generally considered the rarest human blood type?', correctIdx: 3, choices: ['O-', 'B-', 'A-', 'AB-'] },
  { id: 's31', category: 'SCIENCE', question: 'Which organ produces insulin in the human body?', correctIdx: 0, choices: ['Pancreas', 'Liver', 'Thyroid', 'Adrenal gland'] },
  { id: 's32', category: 'SCIENCE', question: 'Which macronutrient is the body\'s main source of quick energy?', correctIdx: 1, choices: ['Protein', 'Carbohydrates', 'Fat', 'Fiber'] },
  { id: 's33', category: 'SCIENCE', question: 'In molecular biology, what does "PCR" stand for?', correctIdx: 2, choices: ['Protein Cellular Response', 'Pathogen Containment Routine', 'Polymerase Chain Reaction', 'Plasma Coagulation Run'] },
  { id: 's34', category: 'SCIENCE', question: 'How many electrons does a neutral hydrogen atom have?', correctIdx: 3, choices: ['0', '4', '2', '1'] },
  { id: 's35', category: 'SCIENCE', question: 'Which is the lightest metal on the periodic table?', correctIdx: 0, choices: ['Lithium', 'Aluminum', 'Sodium', 'Magnesium'] },
  { id: 's36', category: 'SCIENCE', question: 'What is the chemical symbol for potassium?', correctIdx: 1, choices: ['Po', 'K', 'Pt', 'P'] },
  { id: 's37', category: 'SCIENCE', question: 'What is the chemical symbol for silver?', correctIdx: 2, choices: ['Si', 'Sv', 'Ag', 'Au'] },
  { id: 's38', category: 'SCIENCE', question: 'Which scientist proposed the heliocentric model of the solar system?', correctIdx: 3, choices: ['Galileo', 'Kepler', 'Brahe', 'Copernicus'] },
  { id: 's39', category: 'SCIENCE', question: 'What is the SI unit of force?', correctIdx: 0, choices: ['Newton', 'Joule', 'Pascal', 'Watt'] },

  // HISTORY (25)
  { id: 'h13', category: 'HISTORY', question: 'Who was the longest-reigning British monarch in history?', correctIdx: 1, choices: ['Queen Victoria', 'Queen Elizabeth II', 'King George III', 'King Henry VIII'] },
  { id: 'h14', category: 'HISTORY', question: 'In which country did the Renaissance begin?', correctIdx: 2, choices: ['France', 'Germany', 'Italy', 'Spain'] },
  { id: 'h15', category: 'HISTORY', question: 'Who is credited as the primary author of the U.S. Declaration of Independence?', correctIdx: 3, choices: ['Benjamin Franklin', 'John Adams', 'George Washington', 'Thomas Jefferson'] },
  { id: 'h16', category: 'HISTORY', question: 'Which war was fought between the U.S. North and South in the 1860s?', correctIdx: 0, choices: ['Civil War', 'Revolutionary War', 'War of 1812', 'Spanish-American War'] },
  { id: 'h17', category: 'HISTORY', question: 'In what year did the Titanic sink?', correctIdx: 1, choices: ['1898', '1912', '1920', '1905'] },
  { id: 'h18', category: 'HISTORY', question: 'Genghis Khan founded which empire?', correctIdx: 2, choices: ['Ottoman', 'Persian', 'Mongol', 'Han'] },
  { id: 'h19', category: 'HISTORY', question: 'Who was the first woman to win a Nobel Prize?', correctIdx: 3, choices: ['Rosalind Franklin', 'Ada Lovelace', 'Lise Meitner', 'Marie Curie'] },
  { id: 'h20', category: 'HISTORY', question: 'Which conflict was once nicknamed "the war to end all wars"?', correctIdx: 0, choices: ['World War I', 'World War II', 'The Crimean War', 'The Korean War'] },
  { id: 'h21', category: 'HISTORY', question: 'Which U.S. president was assassinated in Dallas in 1963?', correctIdx: 1, choices: ['Lyndon B. Johnson', 'John F. Kennedy', 'Dwight Eisenhower', 'Richard Nixon'] },
  { id: 'h22', category: 'HISTORY', question: 'The Cold War was primarily a standoff between the U.S. and which other power?', correctIdx: 2, choices: ['China', 'Cuba', 'Soviet Union', 'East Germany'] },
  { id: 'h23', category: 'HISTORY', question: 'Who painted the ceiling of the Sistine Chapel?', correctIdx: 3, choices: ['Raphael', 'Caravaggio', 'Leonardo da Vinci', 'Michelangelo'] },
  { id: 'h24', category: 'HISTORY', question: 'Which ancient civilization is credited with inventing the wheel?', correctIdx: 0, choices: ['Sumerians', 'Egyptians', 'Greeks', 'Chinese'] },
  { id: 'h25', category: 'HISTORY', question: 'Which famous document begins with "We the People"?', correctIdx: 1, choices: ['Declaration of Independence', 'U.S. Constitution', 'Bill of Rights', 'Articles of Confederation'] },
  { id: 'h26', category: 'HISTORY', question: 'The Hundred Years\' War was fought between France and which other country?', correctIdx: 2, choices: ['Spain', 'Germany', 'England', 'Italy'] },
  { id: 'h27', category: 'HISTORY', question: 'In what year did the French Revolution begin?', correctIdx: 3, choices: ['1715', '1750', '1812', '1789'] },
  { id: 'h28', category: 'HISTORY', question: 'Who led Nazi Germany during World War II?', correctIdx: 0, choices: ['Adolf Hitler', 'Heinrich Himmler', 'Erwin Rommel', 'Hermann Göring'] },
  { id: 'h29', category: 'HISTORY', question: 'On which ship did Charles Darwin make his famous voyage?', correctIdx: 1, choices: ['HMS Endeavour', 'HMS Beagle', 'HMS Victory', 'HMS Bounty'] },
  { id: 'h30', category: 'HISTORY', question: 'Which civilization developed the first known writing system, cuneiform?', correctIdx: 2, choices: ['Egyptian', 'Phoenician', 'Sumerian', 'Indus Valley'] },
  { id: 'h31', category: 'HISTORY', question: 'In what year did the Soviet Union officially dissolve?', correctIdx: 3, choices: ['1985', '1987', '1990', '1991'] },
  { id: 'h32', category: 'HISTORY', question: 'Who is considered the first emperor of unified China?', correctIdx: 0, choices: ['Qin Shi Huang', 'Sun Tzu', 'Kublai Khan', 'Confucius'] },
  { id: 'h33', category: 'HISTORY', question: 'After Hiroshima, the second atomic bomb fell on which Japanese city?', correctIdx: 1, choices: ['Kyoto', 'Nagasaki', 'Osaka', 'Yokohama'] },
  { id: 'h34', category: 'HISTORY', question: 'Who painted "The Last Supper"?', correctIdx: 2, choices: ['Michelangelo', 'Botticelli', 'Leonardo da Vinci', 'Titian'] },
  { id: 'h35', category: 'HISTORY', question: 'In what year did India gain independence from British rule?', correctIdx: 3, choices: ['1922', '1935', '1962', '1947'] },
  { id: 'h36', category: 'HISTORY', question: 'Which battle marked Napoleon\'s final defeat in 1815?', correctIdx: 0, choices: ['Waterloo', 'Trafalgar', 'Austerlitz', 'Borodino'] },
  { id: 'h37', category: 'HISTORY', question: 'Which Chinese dynasty oversaw the construction of the Forbidden City?', correctIdx: 1, choices: ['Qing', 'Ming', 'Tang', 'Han'] },

  // GEOGRAPHY (25)
  { id: 'gg13', category: 'GEOGRAPHY', question: 'What is the capital of Japan?', correctIdx: 2, choices: ['Kyoto', 'Osaka', 'Tokyo', 'Sapporo'] },
  { id: 'gg14', category: 'GEOGRAPHY', question: 'In which country is Mount Kilimanjaro?', correctIdx: 3, choices: ['Kenya', 'Uganda', 'Ethiopia', 'Tanzania'] },
  { id: 'gg15', category: 'GEOGRAPHY', question: 'Roughly how many countries does the Danube River flow through?', correctIdx: 0, choices: ['10', '6', '4', '14'] },
  { id: 'gg16', category: 'GEOGRAPHY', question: 'Which is the largest country in South America by area?', correctIdx: 1, choices: ['Argentina', 'Brazil', 'Peru', 'Chile'] },
  { id: 'gg17', category: 'GEOGRAPHY', question: 'Which continent has the highest average elevation?', correctIdx: 2, choices: ['Asia', 'South America', 'Antarctica', 'North America'] },
  { id: 'gg18', category: 'GEOGRAPHY', question: 'What is the capital of South Korea?', correctIdx: 3, choices: ['Busan', 'Incheon', 'Pyongyang', 'Seoul'] },
  { id: 'gg19', category: 'GEOGRAPHY', question: 'Which country shares the longest land border with the United States?', correctIdx: 0, choices: ['Canada', 'Mexico', 'Russia', 'Cuba'] },
  { id: 'gg20', category: 'GEOGRAPHY', question: 'Lake Baikal — the world\'s deepest lake — is in which country?', correctIdx: 1, choices: ['Mongolia', 'Russia', 'China', 'Kazakhstan'] },
  { id: 'gg21', category: 'GEOGRAPHY', question: 'Mount Fuji is in which country?', correctIdx: 2, choices: ['China', 'Korea', 'Japan', 'Taiwan'] },
  { id: 'gg22', category: 'GEOGRAPHY', question: 'The Strait of Gibraltar separates Europe from which other continent?', correctIdx: 3, choices: ['Asia', 'Antarctica', 'South America', 'Africa'] },
  { id: 'gg23', category: 'GEOGRAPHY', question: 'What is the world\'s largest island?', correctIdx: 0, choices: ['Greenland', 'Madagascar', 'Borneo', 'New Guinea'] },
  { id: 'gg24', category: 'GEOGRAPHY', question: 'Which body of water is the saltiest of these?', correctIdx: 1, choices: ['Mediterranean Sea', 'Dead Sea', 'Red Sea', 'Caspian Sea'] },
  { id: 'gg25', category: 'GEOGRAPHY', question: 'How many states are in the United States?', correctIdx: 2, choices: ['48', '49', '50', '52'] },
  { id: 'gg26', category: 'GEOGRAPHY', question: 'What is the capital of Egypt?', correctIdx: 3, choices: ['Alexandria', 'Luxor', 'Giza', 'Cairo'] },
  { id: 'gg27', category: 'GEOGRAPHY', question: 'Which mountain range is the traditional dividing line between Europe and Asia?', correctIdx: 0, choices: ['Ural', 'Caucasus', 'Carpathian', 'Alps'] },
  { id: 'gg28', category: 'GEOGRAPHY', question: 'What is the deepest known ocean trench?', correctIdx: 1, choices: ['Java Trench', 'Mariana Trench', 'Tonga Trench', 'Puerto Rico Trench'] },
  { id: 'gg29', category: 'GEOGRAPHY', question: 'Which country has the longest coastline in the world?', correctIdx: 2, choices: ['Russia', 'Australia', 'Canada', 'Indonesia'] },
  { id: 'gg30', category: 'GEOGRAPHY', question: 'Reykjavik is the capital of which country?', correctIdx: 3, choices: ['Greenland', 'Norway', 'Sweden', 'Iceland'] },
  { id: 'gg31', category: 'GEOGRAPHY', question: 'Mount Olympus is in which country?', correctIdx: 0, choices: ['Greece', 'Turkey', 'Italy', 'Cyprus'] },
  { id: 'gg32', category: 'GEOGRAPHY', question: 'In which country is the Atacama Desert mostly located?', correctIdx: 1, choices: ['Argentina', 'Chile', 'Peru', 'Bolivia'] },
  { id: 'gg33', category: 'GEOGRAPHY', question: 'How many sovereign countries are recognized in Africa?', correctIdx: 2, choices: ['48', '50', '54', '60'] },
  { id: 'gg34', category: 'GEOGRAPHY', question: 'Which European country is famously shaped like a boot?', correctIdx: 3, choices: ['Spain', 'Greece', 'Portugal', 'Italy'] },
  { id: 'gg35', category: 'GEOGRAPHY', question: 'The Suez Canal connects the Mediterranean Sea to which other body of water?', correctIdx: 0, choices: ['Red Sea', 'Black Sea', 'Persian Gulf', 'Arabian Sea'] },
  { id: 'gg36', category: 'GEOGRAPHY', question: 'Which is the world\'s largest landlocked country?', correctIdx: 1, choices: ['Mongolia', 'Kazakhstan', 'Ethiopia', 'Bolivia'] },
  { id: 'gg37', category: 'GEOGRAPHY', question: 'The equator passes through which African country?', correctIdx: 2, choices: ['South Africa', 'Egypt', 'Kenya', 'Morocco'] },

  // POP CULTURE (25)
  { id: 'p13', category: 'POP CULTURE', question: 'Which animated Disney film features a snowman named Olaf?', correctIdx: 3, choices: ['Tangled', 'Moana', 'Brave', 'Frozen'] },
  { id: 'p14', category: 'POP CULTURE', question: 'Who composed "The Four Seasons"?', correctIdx: 0, choices: ['Vivaldi', 'Mozart', 'Bach', 'Handel'] },
  { id: 'p15', category: 'POP CULTURE', question: 'Which TV series prominently features the Lannister family?', correctIdx: 1, choices: ['The Crown', 'Game of Thrones', 'Vikings', 'Outlander'] },
  { id: 'p16', category: 'POP CULTURE', question: 'Which film became the first to gross over $2 billion worldwide?', correctIdx: 2, choices: ['Titanic', 'The Force Awakens', 'Avatar', 'Avengers: Endgame'] },
  { id: 'p17', category: 'POP CULTURE', question: 'Which musician is widely known as the "King of Pop"?', correctIdx: 3, choices: ['Prince', 'Elvis Presley', 'David Bowie', 'Michael Jackson'] },
  { id: 'p18', category: 'POP CULTURE', question: 'Which film won the very first Academy Award for Best Animated Feature?', correctIdx: 0, choices: ['Shrek', 'Finding Nemo', 'The Incredibles', 'Toy Story'] },
  { id: 'p19', category: 'POP CULTURE', question: 'Who created the comic strip "Peanuts"?', correctIdx: 1, choices: ['Bill Watterson', 'Charles Schulz', 'Garry Trudeau', 'Jim Davis'] },
  { id: 'p20', category: 'POP CULTURE', question: 'In Star Wars, who is revealed to be Luke Skywalker\'s father?', correctIdx: 2, choices: ['Obi-Wan Kenobi', 'Han Solo', 'Darth Vader', 'Emperor Palpatine'] },
  { id: 'p21', category: 'POP CULTURE', question: 'Which artist painted "The Persistence of Memory" (the melting clocks)?', correctIdx: 3, choices: ['Picasso', 'Magritte', 'Miró', 'Salvador Dalí'] },
  { id: 'p22', category: 'POP CULTURE', question: 'Which actor plays Jack Sparrow in the "Pirates of the Caribbean" films?', correctIdx: 0, choices: ['Johnny Depp', 'Orlando Bloom', 'Geoffrey Rush', 'Russell Crowe'] },
  { id: 'p23', category: 'POP CULTURE', question: 'Which social media platform did Elon Musk acquire and rename in 2022–23?', correctIdx: 1, choices: ['Facebook', 'Twitter', 'Snapchat', 'TikTok'] },
  { id: 'p24', category: 'POP CULTURE', question: 'The song "Defying Gravity" comes from which Broadway musical?', correctIdx: 2, choices: ['Rent', 'Les Misérables', 'Wicked', 'Hamilton'] },
  { id: 'p25', category: 'POP CULTURE', question: 'Who provides the voice of Woody in the Toy Story films?', correctIdx: 3, choices: ['Tim Allen', 'John Goodman', 'Billy Crystal', 'Tom Hanks'] },
  { id: 'p26', category: 'POP CULTURE', question: 'Which video game franchise features a hero named Link?', correctIdx: 0, choices: ['The Legend of Zelda', 'Final Fantasy', 'Halo', 'Kingdom Hearts'] },
  { id: 'p27', category: 'POP CULTURE', question: 'Who wrote both "1984" and "Animal Farm"?', correctIdx: 1, choices: ['Aldous Huxley', 'George Orwell', 'Ray Bradbury', 'Kurt Vonnegut'] },
  { id: 'p28', category: 'POP CULTURE', question: 'Which director is most associated with "Pulp Fiction" and "Kill Bill"?', correctIdx: 2, choices: ['Martin Scorsese', 'David Fincher', 'Quentin Tarantino', 'Coen Brothers'] },
  { id: 'p29', category: 'POP CULTURE', question: 'Which singer released the breakthrough album "1989"?', correctIdx: 3, choices: ['Adele', 'Katy Perry', 'Lady Gaga', 'Taylor Swift'] },
  { id: 'p30', category: 'POP CULTURE', question: 'Which Disney villain wants to make a coat from Dalmatian puppies?', correctIdx: 0, choices: ['Cruella de Vil', 'Maleficent', 'Ursula', 'Jafar'] },
  { id: 'p31', category: 'POP CULTURE', question: 'Which sitcom is set in the fictional town of Pawnee, Indiana?', correctIdx: 1, choices: ['The Office', 'Parks and Recreation', '30 Rock', 'Community'] },
  { id: 'p32', category: 'POP CULTURE', question: 'Which sitcom popularized the catchphrase "No soup for you!"?', correctIdx: 2, choices: ['Friends', 'Cheers', 'Seinfeld', 'Frasier'] },
  { id: 'p33', category: 'POP CULTURE', question: 'Who painted "Girl with a Pearl Earring"?', correctIdx: 3, choices: ['Rembrandt', 'Caravaggio', 'Renoir', 'Vermeer'] },
  { id: 'p34', category: 'POP CULTURE', question: 'Which animated TV family lives in the prehistoric town of Bedrock?', correctIdx: 0, choices: ['The Flintstones', 'The Jetsons', 'The Simpsons', 'The Smurfs'] },
  { id: 'p35', category: 'POP CULTURE', question: 'Who is the original author of "Romeo and Juliet"?', correctIdx: 1, choices: ['Christopher Marlowe', 'William Shakespeare', 'Geoffrey Chaucer', 'John Milton'] },
  { id: 'p36', category: 'POP CULTURE', question: 'Which band\'s lineup originally included John, Paul, George, and Ringo?', correctIdx: 2, choices: ['The Rolling Stones', 'The Who', 'The Beatles', 'The Kinks'] },
  { id: 'p37', category: 'POP CULTURE', question: 'Which is the longest-running scripted prime-time TV show in U.S. history?', correctIdx: 3, choices: ['Law & Order', 'South Park', 'Family Guy', 'The Simpsons'] },

  // SPORTS (25)
  { id: 'sp13', category: 'SPORTS', question: 'How many players from one soccer team are on the field at the start of a match?', correctIdx: 0, choices: ['11', '9', '10', '12'] },
  { id: 'sp14', category: 'SPORTS', question: 'In which sport is the Stanley Cup awarded?', correctIdx: 1, choices: ['Basketball', 'Hockey', 'Baseball', 'Lacrosse'] },
  { id: 'sp15', category: 'SPORTS', question: 'How many minutes are in a regulation NBA game?', correctIdx: 2, choices: ['40', '44', '48', '60'] },
  { id: 'sp16', category: 'SPORTS', question: 'In which country did table tennis originate as a parlor game?', correctIdx: 3, choices: ['China', 'Japan', 'United States', 'England'] },
  { id: 'sp17', category: 'SPORTS', question: 'Which sport uses a "shuttlecock"?', correctIdx: 0, choices: ['Badminton', 'Squash', 'Pickleball', 'Racquetball'] },
  { id: 'sp18', category: 'SPORTS', question: 'How many bases are there on a baseball diamond?', correctIdx: 1, choices: ['3', '4', '5', '6'] },
  { id: 'sp19', category: 'SPORTS', question: 'In which sport would you "tee off"?', correctIdx: 2, choices: ['Cricket', 'Bowling', 'Golf', 'Polo'] },
  { id: 'sp20', category: 'SPORTS', question: 'The Tour de France is what kind of race?', correctIdx: 3, choices: ['Marathon running', 'Horse racing', 'Auto racing', 'Cycling'] },
  { id: 'sp21', category: 'SPORTS', question: 'What is the inside diameter of a regulation basketball hoop, in inches?', correctIdx: 0, choices: ['18', '16', '20', '22'] },
  { id: 'sp22', category: 'SPORTS', question: 'How long is an Olympic-size swimming pool?', correctIdx: 1, choices: ['25 m', '50 m', '75 m', '100 m'] },
  { id: 'sp23', category: 'SPORTS', question: 'Who holds Major League Baseball\'s career home-run record (762)?', correctIdx: 2, choices: ['Hank Aaron', 'Babe Ruth', 'Barry Bonds', 'Albert Pujols'] },
  { id: 'sp24', category: 'SPORTS', question: 'Which country has won the most FIFA Men\'s World Cups?', correctIdx: 3, choices: ['Germany', 'Italy', 'Argentina', 'Brazil'] },
  { id: 'sp25', category: 'SPORTS', question: 'How long is a standard marathon, to the nearest tenth of a mile?', correctIdx: 0, choices: ['26.2 mi', '24.0 mi', '30.0 mi', '21.1 mi'] },
  { id: 'sp26', category: 'SPORTS', question: 'In which sport are the terms "deuce" and "advantage" used?', correctIdx: 1, choices: ['Cricket', 'Tennis', 'Volleyball', 'Squash'] },
  { id: 'sp27', category: 'SPORTS', question: 'How many skaters (excluding the goalie) does each team have on the ice in regulation hockey?', correctIdx: 2, choices: ['3', '4', '5', '6'] },
  { id: 'sp28', category: 'SPORTS', question: 'In Rugby Union, how many points is a try worth?', correctIdx: 3, choices: ['2', '3', '4', '5'] },
  { id: 'sp29', category: 'SPORTS', question: 'In bowling, what term describes two strikes in a row?', correctIdx: 0, choices: ['Double', 'Turkey', 'Spare', 'Ham'] },
  { id: 'sp30', category: 'SPORTS', question: 'Wimbledon is a major championship in which sport?', correctIdx: 1, choices: ['Cricket', 'Tennis', 'Badminton', 'Squash'] },
  { id: 'sp31', category: 'SPORTS', question: 'Which boxer famously called himself "The Greatest"?', correctIdx: 2, choices: ['Mike Tyson', 'Joe Frazier', 'Muhammad Ali', 'Sugar Ray Leonard'] },
  { id: 'sp32', category: 'SPORTS', question: 'Who scored the famous 1986 World Cup "Hand of God" goal?', correctIdx: 3, choices: ['Pelé', 'Zico', 'Ronaldinho', 'Diego Maradona'] },
  { id: 'sp33', category: 'SPORTS', question: 'How many Formula 1 World Championships did Michael Schumacher win?', correctIdx: 0, choices: ['7', '5', '6', '8'] },
  { id: 'sp34', category: 'SPORTS', question: 'How many quarters make up a regulation NFL game?', correctIdx: 1, choices: ['2', '4', '3', '8'] },
  { id: 'sp35', category: 'SPORTS', question: 'Which gymnastics event involves performing on a 4-inch wide elevated beam?', correctIdx: 2, choices: ['Vault', 'Floor exercise', 'Balance beam', 'Pommel horse'] },
  { id: 'sp36', category: 'SPORTS', question: 'What is the maximum possible score in a single game of ten-pin bowling?', correctIdx: 3, choices: ['200', '250', '275', '300'] },
  { id: 'sp37', category: 'SPORTS', question: 'In which sport are spiked shoes worn for traction on a track?', correctIdx: 0, choices: ['Track and field', 'Skiing', 'Curling', 'Equestrian'] },
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
