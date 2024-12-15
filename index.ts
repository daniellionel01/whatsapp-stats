import * as fs from "fs";

interface Message {
  timestamp: Date;
  sender: string;
  content: string;
}

interface Statistics {
  duck: number;
  totalMessages: { [sender: string]: number };
  totalWords: { [sender: string]: number };
  totalCharacters: { [sender: string]: number };
  averageWordsPerMessage: { [sender: string]: number };
  emojiUsage: { [sender: string]: number };
  dayOfWeekDistribution: { [day: string]: number };
  hourlyDistribution: { [hour: string]: number };
  mostUsedWords: { [word: string]: number };
  messagesByDate: { [date: string]: number }; // Added this
}

const NON_TEXT_PATTERNS = ["image omitted", "GIF omitted"];

function parseLine(line: string): Message | null {
  // Check if line starts with timestamp format
  if (!line.startsWith("[")) return null;

  // Split timestamp and rest
  const closingBracket = line.indexOf("]");
  if (closingBracket === -1) return null;

  const timestamp = line.slice(1, closingBracket);
  const rest = line.slice(closingBracket + 2); // +2 to skip '] '

  // Split sender and content
  const colonIndex = rest.indexOf(": ");
  if (colonIndex === -1) return null;

  const sender = rest.slice(0, colonIndex);
  const content = rest.slice(colonIndex + 2);

  // Skip non-text content
  if (
    NON_TEXT_PATTERNS.some((pattern) =>
      content.trim().toLowerCase().includes(pattern),
    )
  ) {
    return null;
  }

  // Parse timestamp
  const [date, time] = timestamp.split(", ");
  const [day, month, year] = date.split(".");
  const [hours, minutes, seconds] = time.split(":");

  const parsedDate = new Date(
    2000 + parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    parseInt(hours),
    parseInt(minutes),
    parseInt(seconds),
  );

  if (isNaN(parsedDate.getTime())) return null;

  return {
    timestamp: parsedDate,
    sender: sender.trim(),
    content: content.trim(),
  };
}

function analyzeMessages(messages: Message[]): Statistics {
  const stats: Statistics = {
    duck: 0,
    totalMessages: {},
    totalWords: {},
    totalCharacters: {},
    averageWordsPerMessage: {},
    emojiUsage: {},
    dayOfWeekDistribution: {
      Monday: 0,
      Tuesday: 0,
      Wednesday: 0,
      Thursday: 0,
      Friday: 0,
      Saturday: 0,
      Sunday: 0,
    },
    hourlyDistribution: {},
    mostUsedWords: {},
    messagesByDate: {}, // Initialize new field
  };

  // Initialize hourly distribution
  for (let i = 0; i < 24; i++) {
    stats.hourlyDistribution[i] = 0;
  }

  const wordCounts: { [word: string]: number } = {};

  for (const message of messages) {
    const sender = message.sender;
    const content = message.content;
    const words = content.split(/\s+/).filter((word) => word.length > 0);

    // Initialize sender stats if needed
    if (!stats.totalMessages[sender]) {
      stats.totalMessages[sender] = 0;
      stats.totalWords[sender] = 0;
      stats.totalCharacters[sender] = 0;
      stats.emojiUsage[sender] = 0;
    }

    // Update sender stats
    stats.totalMessages[sender]++;
    stats.totalWords[sender] += words.length;
    stats.totalCharacters[sender] += content.length;

    // Count emojis (using a simple range check)
    const emojiCount = [...content].filter((char) => {
      const code = char.codePointAt(0);
      return code ? code > 0x1f000 : false;
    }).length;
    stats.emojiUsage[sender] += emojiCount;

    // Update distributions
    const dayOfWeek = message.timestamp.toLocaleDateString("en-US", {
      weekday: "long",
    });
    const hour = message.timestamp.getHours();

    stats.dayOfWeekDistribution[dayOfWeek]++;
    stats.hourlyDistribution[hour]++;

    // Word frequency analysis
    words.forEach((word) => {
      const cleanedWord = word
        .toLowerCase()
        .replace(/[^a-zA-ZäöüÄÖÜß]/g, "")
        .trim();

      if (cleanedWord && cleanedWord.length > 2) {
        wordCounts[cleanedWord] = (wordCounts[cleanedWord] || 0) + 1;
      }
    });

    const matches = message.content.match(/duck/g);
    if (matches) {
      stats.duck += matches.length;
    }

    const dateStr = message.timestamp
      .toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
      })
      .replace(/\//g, ".");

    stats.messagesByDate[dateStr] = (stats.messagesByDate[dateStr] || 0) + 1;
  }

  // Calculate averages
  Object.keys(stats.totalMessages).forEach((sender) => {
    stats.averageWordsPerMessage[sender] =
      stats.totalWords[sender] / stats.totalMessages[sender];
  });

  // Get top 100 words
  stats.mostUsedWords = Object.fromEntries(
    Object.entries(wordCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 100),
  );

  return stats;
}

function calculatePercentage(value: number, total: number): string {
  return ((value / total) * 100).toFixed(1) + "%";
}

function main() {
  const chatFile = fs.readFileSync("_chat.txt", "utf-8");
  const lines = chatFile.split("\n");
  const messages = lines
    .map(parseLine)
    .filter((msg): msg is Message => msg !== null);

  // Debug: Print first few parsed messages
  console.log("Sample of parsed messages:");
  messages.slice(0, 5).forEach((msg) => {
    console.log({
      timestamp: msg.timestamp.toISOString(),
      sender: msg.sender,
      content: msg.content,
    });
  });

  const stats = analyzeMessages(messages);

  console.log("\nChat Statistics:\n");

  console.log("Messages per Person:");
  console.log(stats.totalMessages);

  console.log("\nAverage Words per Message:");
  Object.entries(stats.averageWordsPerMessage).forEach(([sender, avg]) => {
    console.log(`${sender}: ${avg.toFixed(2)}`);
  });

  console.log("\nEmoji Usage:");
  console.log(stats.emojiUsage);

  console.log("\Duck:", stats.duck);

  // Messages per Person (as percentages)
  const totalMessageCount = Object.values(stats.totalMessages).reduce(
    (a, b) => a + b,
    0,
  );
  console.log("Message Distribution by Person:");
  Object.entries(stats.totalMessages)
    .sort(([, a], [, b]) => b - a)
    .forEach(([sender, count]) => {
      console.log(
        `${sender}: ${calculatePercentage(count, totalMessageCount)} (${count} messages)`,
      );
    });

  // Day of Week Distribution (as percentages)
  console.log("\nMessage Distribution by Day:");
  const totalDayMessages = Object.values(stats.dayOfWeekDistribution).reduce(
    (a, b) => a + b,
    0,
  );
  Object.entries(stats.dayOfWeekDistribution).forEach(([day, count]) => {
    console.log(
      `${day.padEnd(9)}: ${calculatePercentage(count, totalDayMessages)} (${count} messages)`,
    );
  });

  // Hourly Distribution (as percentages)
  console.log("\nMessage Distribution by Hour:");
  const totalHourMessages = Object.values(stats.hourlyDistribution).reduce(
    (a, b) => a + b,
    0,
  );
  Object.entries(stats.hourlyDistribution)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .forEach(([hour, count]) => {
      const timeStr = `${hour.padStart(2, "0")}:00-${(parseInt(hour) + 1).toString().padStart(2, "0")}:00`;
      console.log(
        `${timeStr}: ${calculatePercentage(count, totalHourMessages)} (${count} messages)`,
      );
    });

  console.log("\nTop 100 Words:");
  Object.entries(stats.mostUsedWords)
    .slice(0, 100)
    .forEach(([word, count], index) => {
      console.log(
        `${(index + 1).toString().padStart(2, " ")}. ${word}: ${count}`,
      );
    });

  // Find busiest day
  const [busiestDay, messageCount] = Object.entries(stats.messagesByDate).sort(
    ([, a], [, b]) => b - a,
  )[0];

  console.log(`\nBusiest day was ${busiestDay} with ${messageCount} messages`);
}

main();
