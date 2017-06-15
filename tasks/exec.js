module.exports = function(config, dstDir, pkg, task, tasks, next) {
    console.log('[' + pkg.name + ']\tEXEC ' + JSON.stringify(task));
    next(config, dstDir, pkg, tasks, next);
}