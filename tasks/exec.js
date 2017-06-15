module.exports = function(config, dstDir, pkg, task, tasks, next) {
    console.log('TODO: EXEC ' + JSON.stringify(task));
    next(config, dstDir, pkg, tasks, next);
}