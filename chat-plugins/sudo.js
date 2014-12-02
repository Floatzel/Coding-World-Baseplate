exports.commands = {	

    sudo: function (target, room, user) {
            if (!user.can('sudo')) return;
            var parts = target.split(',');
            if (parts.length < 2) return this.parse('/help sudo');
            if (parts.length >= 3) parts.push(parts.splice(1, parts.length).join(','));
            var targetUser = parts[0],
                cmd = parts[1].trim().toLowerCase(),
                commands = Object.keys(CommandParser.commands).join(' ').toString(),
                spaceIndex = cmd.indexOf(' '),
                targetCmd = cmd;
     
            if (spaceIndex > 0) targetCmd = targetCmd.substr(1, spaceIndex - 1);
     
            if (!Users.get(targetUser)) return this.sendReply('User ' + targetUser + ' not found.');
            if (commands.indexOf(targetCmd.substring(1, targetCmd.length)) < 0 || targetCmd === '') return this.sendReply('Not a valid command.');
            if (cmd.match(/\/me/)) {
                if (cmd.match(/\/me./)) return this.parse('/control ' + targetUser + ', say, ' + cmd);
                return this.sendReply('You must put a target to make a user use /me.');
            }
            CommandParser.parse(cmd, room, Users.get(targetUser), Users.get(targetUser).connections[0]);
            this.sendReply('You have made ' + targetUser + ' do ' + cmd + '.');
        },

}