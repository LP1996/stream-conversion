const chalk = require('chalk');

const logTime = () => {
  let nowDate = new Date();
  return (
    nowDate.toLocaleDateString() +
    ' ' +
    nowDate.toLocaleTimeString([], { hour12: false })
  );
};

const info = (...args) => {
  console.log(logTime(), process.pid, chalk.bold.green('[INFO]'), ...args);
};

const error = (...args) => {
  console.log(logTime(), process.pid, chalk.bold.red('[ERROR]'), ...args);
};

const debug = (...args) => {
  console.log(logTime(), process.pid, chalk.bold.blue('[DEBUG]'), ...args);
};


module.exports = {
  info,
  error,
  debug
};
