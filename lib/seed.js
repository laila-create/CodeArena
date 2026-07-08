const bcrypt = require('bcryptjs');
const db = require('./db');
const fs = require('fs');
const path = require('path');

module.exports = function seed() {
  // Users
  const users = db.read('users');
  if (!users.length) {
    db.insert('users', {
      name: 'Ali',
      email: 'ali@codearena.io',
      password: bcrypt.hashSync('admin123', 10),
      role: 'admin',
      securityQuestion: 'What is your favorite color?',
      securityAnswer: bcrypt.hashSync('blue', 10)
    });
    console.log('✅ Users seeded');
  }

  // Questions
  const questions = db.read('questions');
  if (!questions.length) {
    const qs = [
      { category: 'Python Basics', difficulty: 'easy', question: 'What is the output of type([])?', code: null, options: ["<class 'list'>","<class 'array'>","<class 'tuple'>","<class 'dict'>"], answer: 0, explanation: 'Brackets [] create a list in Python.' },
      { category: 'Python Basics', difficulty: 'easy', question: 'Which keyword defines a function in Python?', code: null, options: ['function','def','fn','define'], answer: 1, explanation: 'Python uses def to declare functions.' },
      { category: 'Python Basics', difficulty: 'hard', question: 'What does this print?', code: 'x = [1,2,3]\ny = x\ny.append(4)\nprint(x)', options: ['[1,2,3]','[1,2,3,4]','Error','None'], answer: 1, explanation: 'y = x copies the reference, not the list. Both point to the same object.' },
      { category: 'Data Structures', difficulty: 'medium', question: 'Time complexity of index access in a Python list?', code: null, options: ['O(n)','O(log n)','O(1)','O(n²)'], answer: 2, explanation: 'Python lists are backed by arrays — index access is O(1).' },
      { category: 'Data Structures', difficulty: 'medium', question: 'What does this print?', code: 'd = {"a":1,"b":2}\nprint(list(d.keys()))', options: ["['a','b']","['1','2']","dict_keys","None"], answer: 0, explanation: 'list() converts dict_keys to a plain list.' },
      { category: 'Data Structures', difficulty: 'hard', question: 'Which structure uses LIFO ordering?', code: null, options: ['Queue','Stack','Linked List','Tree'], answer: 1, explanation: 'Stack = Last In First Out.' },
      { category: 'Algorithms', difficulty: 'easy', question: 'Time complexity of binary search?', code: null, options: ['O(1)','O(n)','O(log n)','O(n log n)'], answer: 2, explanation: 'Binary search halves the space each step → O(log n).' },
      { category: 'Algorithms', difficulty: 'medium', question: 'Which algorithm uses divide and conquer?', code: null, options: ['Bubble Sort','Linear Search','Merge Sort','Selection Sort'], answer: 2, explanation: 'Merge Sort splits the array recursively then merges.' },
      { category: 'Algorithms', difficulty: 'hard', question: 'Average time complexity of quicksort?', code: null, options: ['O(n)','O(n log n)','O(n²)','O(log n)'], answer: 1, explanation: 'Average is O(n log n); worst case O(n²) with bad pivots.' },
      { category: 'Functions', difficulty: 'easy', question: 'What does *args allow?', code: null, options: ['Only kwargs','Fixed args','Variable positional args','No args'], answer: 2, explanation: '*args collects extra positional arguments into a tuple.' },
      { category: 'Functions', difficulty: 'medium', question: 'What does this return?', code: 'def f(x, y=10):\n    return x + y\nprint(f(5))', options: ['5','10','15','Error'], answer: 2, explanation: 'y defaults to 10, so f(5) = 5 + 10 = 15.' },
      { category: 'Functions', difficulty: 'hard', question: 'Output of this lambda?', code: 'f = lambda x: x**2 if x%2==0 else x**3\nprint(f(3))', options: ['9','27','6','3'], answer: 1, explanation: '3 is odd → x**3 = 27.' }
    ];
    qs.forEach(q => db.insert('questions', q));
    console.log('✅ Questions seeded');
  }

  // Settings
  const settPath = path.join(__dirname, '..', 'data', 'settings.json');
  if (!fs.existsSync(settPath)) {
    fs.writeFileSync(settPath, JSON.stringify({
      normalTimer: 30, challengeTimer: 20,
      challengeLives: 3, challengeStreakThreshold: 3,
      questionsPerQuiz: 10, showExplanations: true
    }, null, 2));
    console.log('✅ Settings seeded');
  }
};
