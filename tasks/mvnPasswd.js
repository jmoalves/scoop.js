const fs = require('fs');
const os = require('os');
const path = require('path');
const spawn = require('child_process').spawn;

module.exports = function(config, dstDir, pkg, task, tasks, next) {
    var inject = {
        "password": "XXXyyyZZZ"
    };

    securityRedirect();
    masterPassword();

    function securityRedirect() {
        const relocSecurity = config.mvnSecurity;
        mkdirHierarchySync(path.dirname(relocSecurity));
        if (!fs.existsSync(relocSecurity)) {
            console.log('[' + pkg.name + ']\tmvnPasswd - create ' + relocSecurity);
            fs.writeFileSync(relocSecurity, `<settingsSecurity>
	<relocation>${security}</relocation>
</settingsSecurity>
`);
        }
    }

    function masterPassword() {
        const mavenHome = config.pkg['maven-3.5'].homeDir;
        const maven = path.resolve(mavenHome, 'bin', 'mvn');
        const mvn = spawn(maven, ['--encrypt-master-password', inject.password]);
        mvn.stdout.on('data', (data) => {
            console.log(`stdout: `);
            const password = data;
            const security = path.resolve(os.homedir(), 'teste', '.m2', 'settings-security.xml');
            mkdirHierarchySync(path.dirname(security));
            if (!fs.existsSync(security)) {
                console.log('[' + pkg.name + ']\tmvnPasswd - create ' + security);
                fs.writeFileSync(security, `<settingsSecurity>
	<master>${password}</master>
</settingsSecurity>
`);

            }

            next(config, dstDir, pkg, tasks, next);
        });
    }
}

function mkdirHierarchySync(pathname) {
    if (!pathname) {
        return;
    }

    if (fs.existsSync(pathname)) {
        return;
    }

    mkdirHierarchySync(path.dirname(pathname));

    console.log('[' + pkg.name + ']\tmvnPasswd - mkdir ' + pathname);
    fs.mkdirSync(pathname);
}