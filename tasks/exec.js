module.exports = function(config, pkg, task, tasks, next) {
    console.log('TODO: EXEC ' + JSON.stringify(task));
    next(config, pkg, tasks, next);
}