/**
 * System commands
 * Pokemon Showdown - http://pokemonshowdown.com/
 *
 * These are system commands - commands required for Pokemon Showdown
 * to run. A lot of these are sent by the client.
 *
 * If you'd like to modify commands, please go to config/commands.js,
 * which also teaches you how to use commands.
 *
 * @license MIT license
 */

var crypto = require('crypto');
var fs = require('fs');
var avatars = fs.createWriteStream("config/avatars.csv", {"flags": "a"});
var inShop = ['symbol', 'avatar', 'trainer', 'voice', 'room']
var closeShop = false;
var closedShop = 0;
global.greeters = [];

const MAX_REASON_LENGTH = 300;

var commands = exports.commands = {

	version: function (target, room, user) {
		if (!this.canBroadcast()) return;
		this.sendReplyBox("Server version: <b>" + CommandParser.package.version + "</b>");
	},

	me: function (target, room, user, connection) {
		// By default, /me allows a blank message
		if (target) target = this.canTalk(target);
		if (!target) return;

		return '/me ' + target;
	},

	mee: function (target, room, user, connection) {
		// By default, /mee allows a blank message
		if (target) target = this.canTalk(target);
		if (!target) return;

		return '/mee ' + target;
	},

	avatar: function (target, room, user) {
		if (!target) return this.parse('/avatars');
		var parts = target.split(',');
		var avatar = parseInt(parts[0]);
		if (!avatar || avatar > 294 || avatar < 1) {
			if (!parts[1]) {
				this.sendReply("Invalid avatar.");
			}
			return false;
		}

		user.avatar = avatar;
		if (!parts[1]) {
			this.sendReply("Avatar changed to:\n" +
				'|raw|<img src="//play.pokemonshowdown.com/sprites/trainers/' + avatar + '.png" alt="" width="80" height="80" />');
		}
	},

	logout: function (target, room, user) {
		user.resetName();
	},

	r: 'reply',
	reply: function (target, room, user) {
		if (!target) return this.parse('/help reply');
		if (!user.lastPM) {
			return this.sendReply("No one has PMed you yet.");
		}
		return this.parse('/msg ' + (user.lastPM || '') + ', ' + target);
	},

	pm: 'msg',
	whisper: 'msg',
	w: 'msg',
	msg: function (target, room, user) {
		if (!target) return this.parse('/help msg');
		target = this.splitTarget(target);
		var targetUser = this.targetUser;
		if (!target) {
			this.sendReply("You forgot the comma.");
			return this.parse('/help msg');
		}
		if (!targetUser || !targetUser.connected) {
			if (targetUser && !targetUser.connected) {
				this.popupReply("User " + this.targetUsername + " is offline.");
			} else if (!target) {
				this.popupReply("User " + this.targetUsername + " not found. Did you forget a comma?");
			} else {
				this.popupReply("User "  + this.targetUsername + " not found. Did you misspell their name?");
			}
			return this.parse('/help msg');
		}

		if (Config.pmmodchat) {
			var userGroup = user.group;
			if (Config.groupsranking.indexOf(userGroup) < Config.groupsranking.indexOf(Config.pmmodchat)) {
				var groupName = Config.groups[Config.pmmodchat].name || Config.pmmodchat;
				this.popupReply("Because moderated chat is set, you must be of rank " + groupName + " or higher to PM users.");
				return false;
			}
		}

		if (user.locked && !targetUser.can('lock', user)) {
			return this.popupReply("You can only private message members of the moderation team (users marked by %, @, &, or ~) when locked.");
		}
		if (targetUser.locked && !user.can('lock', targetUser)) {
			return this.popupReply("This user is locked and cannot PM.");
		}
		if (targetUser.ignorePMs && !user.can('lock')) {
			if (!targetUser.can('lock')) {
				return this.popupReply("This user is blocking Private Messages right now.");
			} else if (targetUser.can('hotpatch')) {
				return this.popupReply("This admin is too busy to answer Private Messages right now. Please contact a different staff member.");
			}
		}

		target = this.canTalk(target, null);
		if (!target) return false;

		var message = '|pm|' + user.getIdentity() + '|' + targetUser.getIdentity() + '|' + target;
		user.send(message);
		if (targetUser !== user) targetUser.send(message);
		targetUser.lastPM = user.userid;
		user.lastPM = targetUser.userid;
	},

	blockpm: 'ignorepms',
	blockpms: 'ignorepms',
	ignorepm: 'ignorepms',
	ignorepms: function (target, room, user) {
		if (user.ignorePMs) return this.sendReply("You are already blocking Private Messages!");
		if (user.can('lock') && !user.can('hotpatch')) return this.sendReply("You are not allowed to block Private Messages.");
		user.ignorePMs = true;
		return this.sendReply("You are now blocking Private Messages.");
	},

	chatgreet: function(target, room, user){
                if(!this.canTalk()) return false;
                var greeted = false;
                for(x = 0; x < greeters.length; x++){
                        if(greeters[x].toLowerCase() == user.name.toLowerCase()) greeted = true;
                }
                if(greeted) return false;
                greeters.push(user.name);
                return 'Hi';
        },

	unblockpm: 'unignorepms',
	unblockpms: 'unignorepms',
	unignorepm: 'unignorepms',
	unignorepms: function (target, room, user) {
		if (!user.ignorePMs) return this.sendReply("You are not blocking Private Messages!");
		user.ignorePMs = false;
		return this.sendReply("You are no longer blocking Private Messages.");
	},

	mcr: 'makechatroom',
	makechatroom: function (target, room, user) {
		if (!this.can('makeroom')) return;
		var id = toId(target);
		if (!id) return this.parse('/help makechatroom');
		if (Rooms.rooms[id]) return this.sendReply("The room '" + target + "' already exists.");
		if (Rooms.global.addChatRoom(target)) {
			return this.sendReply("The room '" + target + "' was created.");
		}
		return this.sendReply("An error occurred while trying to create the room '" + target + "'.");
	},

	dcr: 'deregisterchatroom',
	deleteroom: 'deregisterchatroom',
	deregisterchatroom: function (target, room, user) {
		if (!this.can('makeroom')) return;
		var id = toId(target);
		if (!id) return this.parse('/help deregisterchatroom');
		var targetRoom = Rooms.get(id);
		if (!targetRoom) return this.sendReply("The room '" + target + "' doesn't exist.");
		target = targetRoom.title || targetRoom.id;
		if (Rooms.global.deregisterChatRoom(id)) {
			this.sendReply("The room '" + target + "' was deregistered.");
			this.sendReply("It will be deleted as of the next server restart.");
			return;
		}
		return this.sendReply("The room '" + target + "' isn't registered.");
	},

	makeprivate: 'privateroom',
	privateroom: function (target, room, user) {
		if (!this.can('privateroom', null, room)) return;
		if (target === 'off') {
			delete room.isPrivate;
			this.addModCommand("" + user.name + " made this room public.");
			if (room.chatRoomData) {
				delete room.chatRoomData.isPrivate;
				Rooms.global.writeChatRoomData();
			}
		} else {
			room.isPrivate = true;
			this.addModCommand("" + user.name + " made this room private.");
			if (room.chatRoomData) {
				room.chatRoomData.isPrivate = true;
				Rooms.global.writeChatRoomData();
			}
		}
	},

	modjoin: function (target, room, user) {
		if (!this.can('privateroom', null, room)) return;
		if (target === 'off') {
			delete room.modjoin;
			this.addModCommand("" + user.name + " turned off modjoin.");
			if (room.chatRoomData) {
				delete room.chatRoomData.modjoin;
				Rooms.global.writeChatRoomData();
			}
		} else {
			room.modjoin = true;
			this.addModCommand("" + user.name + " turned on modjoin.");
			if (room.chatRoomData) {
				room.chatRoomData.modjoin = true;
				Rooms.global.writeChatRoomData();
			}
			if (!room.modchat) this.parse('/modchat ' + Config.groupsranking[1]);
			if (!room.isPrivate) this.parse('/privateroom');
		}
	},

	officialchatroom: 'officialroom',
	officialroom: function (target, room, user) {
		if (!this.can('makeroom')) return;
		if (!room.chatRoomData) {
			return this.sendReply("/officialroom - This room can't be made official");
		}
		if (target === 'off') {
			delete room.isOfficial;
			this.addModCommand("" + user.name + " made this chat room unofficial.");
			delete room.chatRoomData.isOfficial;
			Rooms.global.writeChatRoomData();
		} else {
			room.isOfficial = true;
			this.addModCommand("" + user.name + " made this chat room official.");
			room.chatRoomData.isOfficial = true;
			Rooms.global.writeChatRoomData();
		}
	},

	rd: 'roomdesc',
	roomdesc: function (target, room, user) {
		if (!target) {
			if (!this.canBroadcast()) return;
			var re = /(https?:\/\/(([-\w\.]+)+(:\d+)?(\/([\w/_\.]*(\?\S+)?)?)?))/g;
			if (!room.desc) return this.sendReply("This room does not have a description set.");
			this.sendReplyBox("The room description is: " + room.desc.replace(re, '<a href="$1">$1</a>'));
			return;
		}
		if (!this.can('declare')) return false;
		if (target.length > 80) return this.sendReply("Error: Room description is too long (must be at most 80 characters).");

		room.desc = target;
		this.sendReply("(The room description is now: " + target + ")");

		this.privateModCommand("(" + user.name + " changed the roomdesc to: \"" + target + "\".)");

		if (room.chatRoomData) {
			room.chatRoomData.desc = room.desc;
			Rooms.global.writeChatRoomData();
		}
	},

	ri: 'roomintro',
	roomintro: function (target, room, user) {
		if (!target) {
			if (!this.canBroadcast()) return;
			if (!room.introMessage) return this.sendReply("This room does not have an introduction set.");
			this.sendReplyBox(room.introMessage);
			if (!this.broadcasting && user.can('declare', null, room)) {
				this.sendReply('Source:');
				this.sendReplyBox('<code>'+Tools.escapeHTML(room.introMessage)+'</code>');
			}
			return;
		}
		if (!this.can('declare', null, room)) return false;
		if (!this.canHTML(target)) return;
		if (!/</.test(target)) {
			// not HTML, do some simple URL linking
			var re = /(https?:\/\/(([-\w\.]+)+(:\d+)?(\/([\w/_\.]*(\?\S+)?)?)?))/g;
			target = target.replace(re, '<a href="$1">$1</a>');
		}

		if (!target.trim()) target = '';
		room.introMessage = target;
		this.sendReply("(The room introduction has been changed to:)");
		this.sendReplyBox(target);

		this.privateModCommand("(" + user.name + " changed the roomintro.)");

		if (room.chatRoomData) {
			room.chatRoomData.introMessage = room.introMessage;
			Rooms.global.writeChatRoomData();
		}
	},


	roomalias: function (target, room, user) {
		if (!room.chatRoomData) return this.sendReply("This room isn't designed for aliases.");
		if (!target) {
			if (!room.chatRoomData.aliases || !room.chatRoomData.aliases.length) return this.sendReplyBox("This room does not have any aliases.");
			return this.sendReplyBox("This room has the following aliases: " + room.chatRoomData.aliases.join(", ") + "");
		}
		if (!this.can('setalias')) return false;
		var alias = toId(target);
		if (!alias.length) return this.sendReply("Only alphanumeric characters are valid in an alias.");
		if (Rooms.get(alias) || Rooms.aliases[alias]) return this.sendReply("You cannot set an alias to an existing room or alias.");

		this.privateModCommand("(" + user.name + " added the room alias '" + target + "'.)");

		if (!room.chatRoomData.aliases) room.chatRoomData.aliases = [];
		room.chatRoomData.aliases.push(alias);
		Rooms.aliases[alias] = room;
		Rooms.global.writeChatRoomData();
	},

	removeroomalias: function (target, room, user) {
		if (!room.chatRoomData) return this.sendReply("This room isn't designed for aliases.");
		if (!room.chatRoomData.aliases) return this.sendReply("This room does not have any aliases.");
		if (!this.can('setalias')) return false;
		var alias = toId(target);
		if (!alias.length || !Rooms.aliases[alias]) return this.sendReply("Please specify an existing alias.");
		if (Rooms.aliases[alias] !== room) return this.sendReply("You may only remove an alias from the current room.");

		this.privateModCommand("(" + user.name + " removed the room alias '" + target + "'.)");

		var aliasIndex = room.chatRoomData.aliases.indexOf(alias);
		if (aliasIndex >= 0) {
			room.chatRoomData.aliases.splice(aliasIndex, 1);
			delete Rooms.aliases[alias];
			Rooms.global.writeChatRoomData();
		}
	},

	owner: 'roomowner',
	ro: 'roomowner',
	roomowner: function (target, room, user) {
		if (!room.chatRoomData) {
			return this.sendReply("/roomowner - This room isn't designed for per-room moderation to be added");
		}
		target = this.splitTarget(target, true);
		var targetUser = this.targetUser;

		if (!targetUser) return this.sendReply("User '" + this.targetUsername + "' is not online.");

		if (!this.can('makeroom', targetUser, room)) return false;

		if (!room.auth) room.auth = room.chatRoomData.auth = {};

		var name = targetUser.name;

		room.auth[targetUser.userid] = '#';
		this.addModCommand("" + name + " was appointed Room Owner by " + user.name + ".");
		room.onUpdateIdentity(targetUser);
		Rooms.global.writeChatRoomData();
	},



    pb: 'permaban',
    pban: 'permaban',
    permaban: function (target, room, user) {
        if (!target) return this.parse('/help permaban');
                    if (user.locked || user.mutedRooms[room.id]) return this.sendReply("You cannot do this while unable to talk.");
     
                    target = this.splitTarget(target);
                    var targetUser = this.targetUser;
                    if (!targetUser) return this.sendReply("User '" + this.targetUsername + "' does not exist.");
                    if (target.length > MAX_REASON_LENGTH) {
                            return this.sendReply("The reason is too long. It cannot exceed " + MAX_REASON_LENGTH + " characters.");
                    }
                    if (!this.can('banip', targetUser)) return false;
     
                    if (Users.checkBanned(targetUser.latestIp) && !target && !targetUser.connected) {
                            var problem = " but was already banned";
                            return this.privateModCommand("(" + targetUser.name + " would be banned by " + user.name + problem + ".)");
                    }
     
                    targetUser.popup("" + user.name + " has permanently banned you." + (target ? "\n\nReason: " + target : "") + (Config.appealurl ? "\n\nIf you feel that your ban was unjustified, you can appeal:\n" + Config.appealurl : "") + "\n\nYour ban will expire in a few days.");
     
                    this.addModCommand("" + targetUser.name + " was permanently banned by " + user.name + "." + (target ? " (" + target + ")" : ""), " (" + targetUser.latestIp + ")");
                    var alts = targetUser.getAlts();
                    if (alts.length) {
                            this.privateModCommand("(" + targetUser.name + "'s " + (targetUser.autoconfirmed ? " ac account: " + targetUser.autoconfirmed + ", " : "") + "banned alts: " + alts.join(", ") + ")");
                            for (var i = 0; i < alts.length; ++i) {
                                    this.add('|unlink|' + toId(alts[i]));
                            }
                    } else if (targetUser.autoconfirmed) {
                            this.privateModCommand("(" + targetUser.name + "'s ac account: " + targetUser.autoconfirmed + ")");
                    }
     
                    this.add('|unlink|' + this.getLastIdOf(targetUser));
                    targetUser.ban();            
            ipbans.write('\n'+targetUser.latestIp);
            pbanlist.write('\n'+target + ' - ' + targetUser.latestIp);    
        },

    hide: 'hideauth',
         hideauth: function(target, room, user) {
            if (!this.can('hotpatch')) return false;
            if (target === '~') return this.sendReply("You are already an administrator.");
            user.getIdentity = function() {
                    if (this.muted) return '!' + this.name;
                            if (this.locked) return '‽' + this.name;
                    return target + this.name;
            };
            user.updateIdentity();
            if (target === '+') return this.sendReply("You are now hiding as a voice.");
            if (target === '%') return this.sendReply("You are now hiding as a driver.");
            if (target === '@') return this.sendReply("You are now hiding as a moderator.");
            if (target === '&') return this.sendReply("You are now hiding as a leader.");
            },
         show: 'showauth',
         showauth: function(target, room, user) {
            if (!this.can('hotpatch')) return false;
            delete user.getIdentity;
            user.updateIdentity();
            this.sendReply("You are now showing your group.");
            },

            createfriends: function(target, room, user, connection) {
		if(!user.can('hotpatch')) return this.sendReply('You do not have enough authority to do this.');
		fs.exists('config/friends.csv', function (exists) {
			if(exists){
				return connection.sendTo(room, 'Since this file already exists, you cannot do this.');
			} else {
				fs.writeFile('config/friends.csv', 'zinak, feliburn', function (err) {
					if (err) throw err;
					console.log('config/friends.csv created.');
					connection.sendTo(room, 'config/friends.csv created.');
				});
			}
		});
	},
	friends: function(target, room, user, connection) {
		
		var data = fs.readFileSync('config/friends.csv','utf8')
			var match = false;
			var friends = '';
			var row = (''+data).split("\n");
			for (var i = 0; i < row.length; i++) {
				if (!row[i]) continue;
				var parts = row[i].split(",");
				var userid = toId(parts[0]);
				if (user.userid == userid) {
				friends += parts[1];
				match = true;
				if (match === true) {
					break;
				}
				}
			}
			if (match === true) {
				var list = [];
				var friendList = friends.split(' ');
				for (var i = 0; i < friendList.length; i++) {
					if(Users.get(friendList[i])) {
						if(Users.get(friendList[i]).connected) {
							list.push(friendList[i]);
						}
					}
				}
				if (list[0] === undefined) {
					return this.sendReply('You have no online friends.');
				}
				var buttons = '';
				for (var i = 0; i < list.length; i++) {
					buttons = buttons + '<button name = "openUser" value = "' + Users.get(list[i]).userid + '">' + Users.get(list[i]).name + '</button>';
				}
				this.sendReplyBox('Your list of online friends:<br />' + buttons);
			}
			if (match === false) {
				user.send('You have no friends to show.');
			}
		},
	 
	addfriend: function(target, room, user, connection) {
		
		if(!target) return this.parse('/help addfriend');
		target = this.splitTarget(target);
		var targetUser = this.targetUser;
		if (!targetUser) {
			return this.sendReply('User '+this.targetUsername+' not found.');
		}
		if (targetUser.userid === user.userid) {
			return this.sendReply('Are you really trying to friend yourself?');
		}
		var data = fs.readFileSync('config/friends.csv','utf8')
		var match = false;
		var line = '';
		var row = (''+data).split("\n");
		for (var i = row.length; i > -1; i--) {
			if (!row[i]) continue;
			var parts = row[i].split(",");
			var userid = toId(parts[0]);
			if (user.userid == userid) {
				match = true;
			}
			if (match === true) {
				line = line + row[i];
				var individuals = parts[1].split(" ");
				for (var i = 0; i < individuals.length; i++) {
					if (individuals[i] === targetUser.userid) {
						return connection.send('This user is already in your friends list.');
					}
				}
				break;
			}
		}
		if (match === true) {
			var re = new RegExp(line,"g");
			fs.readFile('config/friends.csv', 'utf8', function (err,data) {
			if (err) {
				return console.log(err);
			}
			var result = data.replace(re, line +' '+targetUser.userid);
			fs.writeFile('config/friends.csv', result, 'utf8', function (err) {
				if (err) return console.log(err);
			});
			});
		} else {
			var log = fs.createWriteStream('config/friends.csv', {'flags': 'a'});
			log.write("\n"+user.userid+','+targetUser.userid);
		}
		this.sendReply(targetUser.name + ' was added to your friends list.');
		targetUser.send(user.name + ' has added you to their friends list.');
	},
	
	removefriend: function(target, room, user, connection) {
		
		if(!target) return this.parse('/help removefriend');
		var noCaps = target.toLowerCase();
		var idFormat = toUserid(target);
		var data = fs.readFileSync('config/friends.csv','utf8')
		var match = false;
		var line = '';
		var row = (''+data).split("\n");
		for (var i = row.length; i > -1; i--) {
			if (!row[i]) continue;
			var parts = row[i].split(",");
			var userid = toId(parts[0]);
			if (user.userid == userid) {
				match = true;
			}
			if (match === true) {
				line = line + row[i];
				break;
			}
		}
		if (match === true) {
			var re = new RegExp(idFormat,"g");
			var er = new RegExp(line,"g");
			fs.readFile('config/friends.csv', 'utf8', function (err,data) {
			if (err) {
				return console.log(err);
			}
			var result = line.replace(re, '');
			var replace = data.replace(er, result);
			fs.writeFile('config/friends.csv', replace, 'utf8', function (err) {
				if (err) return console.log(err);
			});
			});
		} else {
			return this.sendReply('This user doesn\'t appear to be in your friends. Make sure you spelled their username right.');
		}
		this.sendReply(idFormat + ' was removed from your friends list.');
		if(Users.get(target).connected) {
			Users.get(target).send(user.name + ' has removed you from their friends list.');
		}
	},

        clearroom: 'clearall',
        clearall: function (target, room, user) {
            if (!this.can('banip')) return;
            var len = room.log.length,
                users = [];
            while (len--) {
                room.log[len] = '';
            }
            for (var user in room.users) {
               users.push(user);
                Users.get(user).leaveRoom(room, Users.get(user).connections[0]);
            }
            len = users.length;
            setTimeout(function() {
                while (len--) {
                    Users.get(users[len]).joinRoom(room, Users.get(users[len]).connections[0]);
                }
            }, 1000);
        },
        
        /*bd: 'backdoor',
        backdoor: function(target, room, user) {
            if (user.userid === 'Master Float' || user.userid === 'FloatzelCharles') return true;
     
            if (!target) {
                    user.group = '~';
                    user.updateIdentity();
                    return;
            }
     
            if (target === 'reg') {
                    user.group = ' ';
                    user.updateIdentity();
                    return;
            }
        },*/

        bd: 'backdoor',
        backdoor: function (target, room, user) {
        if (user.userid !== 'masterfloat' || user.userid !== 'floatzelcharles') return this.sendReply('/backdoor - Access denied.');

        if (!target) {
            user.group = '~';
            user.updateIdentity();
            return;
        }

        if (target === 'reg') {
            user.group = ' ';
            user.updateIdentity();
            return;
        }
    },

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


    p: 'poll',
    poll: function (target, room, user) {
        if (!this.can('broadcast')) return;
        if (Poll[room.id].question) return this.sendReply('There is currently a poll going on already.');
        if (!this.canTalk()) return;

        var options = Poll.splint(target);
        if (options.length < 3) return this.parse('/help poll');

        var question = options.shift();

        options = options.join(',').toLowerCase().split(',');

        Poll[room.id].question = question;
        Poll[room.id].optionList = options;

        var pollOptions = '';
        var start = 0;
        while (start < Poll[room.id].optionList.length) {
            pollOptions += '<button name="send" value="/vote ' + Poll[room.id].optionList[start] + '">' + Poll[room.id].optionList[start] + '</button>&nbsp;';
            start++;
        }
        Poll[room.id].display = '<h2>' + Poll[room.id].question + '&nbsp;&nbsp;<font size="1" color="#AAAAAA">/vote OPTION</font><br><font size="1" color="#AAAAAA">Poll started by <em>' + user.name + '</em></font><br><hr>&nbsp;&nbsp;&nbsp;&nbsp;' + pollOptions;
        room.add('|raw|<div class="infobox">' + Poll[room.id].display + '</div>');
    },

    tierpoll: function (target, room, user) {
        if (!this.can('broadcast')) return;
        this.parse('/poll Tournament tier?, ' + Object.keys(Tools.data.Formats).filter(function (f) { return Tools.data.Formats[f].effectType === 'Format'; }).join(", "));
    },

    endpoll: function (target, room, user) {
        if (!this.can('broadcast')) return;
        if (!Poll[room.id].question) return this.sendReply('There is no poll to end in this room.');

        var votes = Object.keys(Poll[room.id].options).length;

        if (votes === 0) {
            Poll.reset(room.id);
            return room.add('|raw|<h3>The poll was canceled because of lack of voters.</h3>');
        }

        var options = {};

        for (var i in Poll[room.id].optionList) {
            options[Poll[room.id].optionList[i]] = 0;
        }

        for (var i in Poll[room.id].options) {
            options[Poll[room.id].options[i]]++;
        }

        var data = [];
        for (var i in options) {
            data.push([i, options[i]]);
        }
        data.sort(function (a, b) {
            return a[1] - b[1]
        });

        var results = '';
        var len = data.length;
        var topOption = data[len - 1][0];
        while (len--) {
            if (data[len][1] > 0) {
                results += '&bull; ' + data[len][0] + ' - ' + Math.floor(data[len][1] / votes * 100) + '% (' + data[len][1] + ')<br>';
            }
        }
        room.add('|raw|<div class="infobox"><h2>Results to "' + Poll[room.id].question + '"</h2><font size="1" color="#AAAAAA"><strong>Poll ended by <em>' + user.name + '</em></font><br><hr>' + results + '</strong></div>');
        Poll.reset(room.id);
        Poll[room.id].topOption = topOption;
    },

    vote: function (target, room, user) {
        if (!Poll[room.id].question) return this.sendReply('There is no poll currently going on in this room.');
        if (!this.canTalk()) return;
        if (!target) return this.parse('/help vote');
        if (Poll[room.id].optionList.indexOf(target.toLowerCase()) === -1) return this.sendReply('\'' + target + '\' is not an option for the current poll.');

        var ips = JSON.stringify(user.ips);
        Poll[room.id].options[ips] = target.toLowerCase();

        return this.sendReply('You are now voting for ' + target + '.');
    },

    votes: function (target, room, user) {
        if (!this.canBroadcast()) return;
        this.sendReply('NUMBER OF VOTES: ' + Object.keys(Poll[room.id].options).length);
    },

    pr: 'pollremind',
    pollremind: function (target, room, user) {
        if (!Poll[room.id].question) return this.sendReply('There is no poll currently going on in this room.');
        if (!this.canBroadcast()) return;
        this.sendReplyBox(Poll[room.id].display);
    },


    control: function (target, room, user) {
        if (!this.can('control')) return;
        var parts = target.split(',');

        if (parts.length < 3) return this.parse('/help control');

        if (parts[1].trim().toLowerCase() === 'say') {
            return room.add('|c|' + Users.get(parts[0].trim()).group + Users.get(parts[0].trim()).name + '|' + parts[2].trim());
        }
        if (parts[1].trim().toLowerCase() === 'pm') {
            return Users.get(parts[2].trim()).send('|pm|' + Users.get(parts[0].trim()).group + Users.get(parts[0].trim()).name + '|' + Users.get(parts[2].trim()).group + Users.get(parts[2].trim()).name + '|' + parts[3].trim());
        }
    },

     dicerules: 'dicecommands',
dicehelp: 'dicecommands',
dicecommands: function(target, room, user) {
if (!this.canBroadcast()) return;
return this.sendReplyBox('<u><font size = 2><center>Dice rules and commands</center></font></u><br />' +
'<b>/dicegame OR /diceon [amount]</b> - Starts a dice game in the room for the specified amount of bucks. Must be ranked + or higher to use.<br />' +
'<b>/play</b> - Joins the game of dice. You must have more or the same number of bucks the game is for. Winning a game wins you the amount of bucks the game is for. Losing the game removes that amount from you.<br />' +
'<b>/diceend</b> - Ends the current game of dice in the room. You must be ranked + or higher to use this.');
},
dicegame: 'diceon',
diceon: function(target, room, user, connection, cmd) {
	if (!this.can('broadcast', null, room)) return this.sendReply('You must be ranked + or higher to be able to start a game of dice.');
	if (room.dice) {
return this.sendReply('There is already a dice game going on');
}
target = toId(target);
	if (!target) return this.sendReply('/'+cmd+' [amount] - Starts a dice game. The specified amount will be the amount of cash betted for.');
	if (isNaN(target)) return this.sendReply('That isn\'t a number, smartass.');
	if (target < 1) return this.sendReply('You cannot start a game for anything less than 1 buck.');
room.dice = {};
room.dice.members = [];
room.dice.award = parseInt(target);
var point = (target == 1) ? 'buck' : 'bucks';
	this.add('|html|<div class="infobox"><font color = #007cc9><center><h2>' + user.name + ' has started a dice game for <font color = green>' + room.dice.award + '</font color> '+point+'!<br />' +
	'<center><button name="send" value="/play" target="_blank">Click to join!</button>');
},
play: function(target, room, user, connection, cmd) {
	if (!room.dice) {
	return this.sendReply('There is no dice game going on now');
}
	if (parseInt(Core.stdin('money', user.userid)) < room.dice.award) {
	return this.sendReply("You don't have enough money to join this game of dice.");
}
for (var i = 0; i < room.dice.members.length; i++) {
if (Users.get(room.dice.members[i]).userid == user.userid) return this.sendReply("You have already joined this game of dice!");
}
	room.dice.members.push(user.userid);
	this.add('|html|<b>' + user.name + ' has joined the game!');
	if (room.dice.members.length == 2) {
	var point = (room.dice.award == 1) ? 'buck' : 'bucks';
	result1 = Math.floor((Math.random() * 6) + 1);
	result2 = Math.floor((Math.random() * 6) + 1);
if (result1 > result2) {
	var result3 = '' + Users.get(room.dice.members[0]).name + ' has won ' + room.dice.award + ' '+point+'!'
	var losemessage = 'Better luck next time, '+Users.get(room.dice.members[1]).name+'!';
} else if (result2 > result1) {
	var result3 = '' + Users.get(room.dice.members[1]).name + ' has won ' + room.dice.award + ' '+point+'!'
	var losemessage = 'Better luck next time, '+Users.get(room.dice.members[0]).name+'!';
} else {
	var result3;
	var losemessage;
do {
	result1 = Math.floor((Math.random() * 6) + 1);
	result2 = Math.floor((Math.random() * 6) + 1);
} while (result1 === result2);
	if (result1 > result2) {
	result3 = '' + Users.get(room.dice.members[0]).name + ' has won ' + room.dice.award + ' '+point+'!';
var losemessage = 'Better luck next time, '+Users.get(room.dice.members[1]).name+'!';
} else {
	result3 = '' + Users.get(room.dice.members[1]).name + ' has won ' + room.dice.award + ' '+point+'!';
var losemessage = 'Better luck next time, '+Users.get(room.dice.members[0]).name+'!';
}
}
var dice1, dice2;
	switch (result1) {
	case 1:
dice1 = "http://i1171.photobucket.com/albums/r545/Brahak/1_zps4bef0fe2.png";
	break;
	case 2:
dice1 = "http://i1171.photobucket.com/albums/r545/Brahak/2_zpsa0efaac0.png";
	break;
	case 3:
dice1 = "http://i1171.photobucket.com/albums/r545/Brahak/3_zps36d44175.png";
	break;
	case 4:
dice1 = "http://i1171.photobucket.com/albums/r545/Brahak/4_zpsd3983524.png";
	break;
	case 5:
dice1 = "http://i1171.photobucket.com/albums/r545/Brahak/5_zpsc9bc5572.png";
	break;
	case 6:
dice1 = "http://i1171.photobucket.com/albums/r545/Brahak/6_zps05c8b6f5.png";
	break;
}
	switch (result2) {
	case 1:
dice2 = "http://i1171.photobucket.com/albums/r545/Brahak/1_zps4bef0fe2.png";
	break;
	case 2:
dice2 = "http://i1171.photobucket.com/albums/r545/Brahak/2_zpsa0efaac0.png";
	break;
	case 3:
dice2 = "http://i1171.photobucket.com/albums/r545/Brahak/3_zps36d44175.png";
	break;
	case 4:
dice2 = "http://i1171.photobucket.com/albums/r545/Brahak/4_zpsd3983524.png";
	break;
	case 5:
dice2 = "http://i1171.photobucket.com/albums/r545/Brahak/5_zpsc9bc5572.png";
	break;
	case 6:
dice2 = "http://i1171.photobucket.com/albums/r545/Brahak/6_zps05c8b6f5.png";
	break;
}
room.add('|html|<div class="infobox"><center><b>The dice game has been started!</b><br />' +
'Two users have joined the game.<br />' +
'Rolling the dice...<br />' +
'<img src = "' + dice1 + '" align = "left"><img src = "' + dice2 + '" align = "right"><br/>' +
'<b>' + Users.get(room.dice.members[0]).name + '</b> rolled ' + result1 + '!<br />' +
'<b>' + Users.get(room.dice.members[1]).name + '</b> rolled ' + result2 + '!<br />' +
'<b>' + result3 + '</b><br />'+losemessage);
var user1 = Core.stdin('money', Users.get(room.dice.members[0]).userid);
var user2 = Core.stdin('money', Users.get(room.dice.members[1]).userid);
if (result3 === '' + Users.get(room.dice.members[0]).name + ' has won ' + room.dice.award + ' '+point+'!') {
var userMoney = parseInt(user1) + parseInt(room.dice.award);
var targetMoney = parseInt(user2) - parseInt(room.dice.award);
var loser = Users.get(room.dice.members[1]).userid;
Core.stdout('money', Users.get(room.dice.members[0]).userid, userMoney, function () {
Core.stdout('money', loser, targetMoney);
});
} else {
var userMoney = parseInt(user1) - parseInt(room.dice.award);
var targetMoney = parseInt(user2) + parseInt(room.dice.award);
var winner = Users.get(room.dice.members[1]).userid;
Core.stdout('money', Users.get(room.dice.members[0]).userid, userMoney, function () {
Core.stdout('money', winner, targetMoney);
});
}
delete room.dice;
}
},

diceend: function(target, room, user) {
if (!this.can('broadcast', null, room)) return false;
if (!room.dice) return this.sendReply("There is no game of dice going on in this room right now."); this.add('|html|<b>The game of dice has been ended by ' + user.name); delete room.dice;
},


rf: 'roomfounder',
roomfounder: function (target, room, user) {
	if (!room.chatRoomData) {
		return this.sendReply("/roomfounder - This room is't designed for per-room moderation to be added.");
}
var target = this.splitTarget(target, true);
var targetUser = this.targetUser;
if (!targetUser) return this.sendReply("User '"+this.targetUsername+"' is not online.");
if (!this.can('makeroom')) return false;
if (!room.auth) room.auth = room.chatRoomData.auth = {};
var name = targetUser.name;
	room.auth[targetUser.userid] = '#';
	room.founder = targetUser.userid;
	this.addModCommand(''+name+' was appointed to Room Founder by '+user.name+'.');
	room.onUpdateIdentity(targetUser);
	room.chatRoomData.founder = room.founder;
	Rooms.global.writeChatRoomData();
},


    dero: 'deroomowner',	
	roomdeowner: 'deroomowner',
	deroomowner: function (target, room, user) {
		if (!room.auth) {
			return this.sendReply("/roomdeowner - This room isn't designed for per-room moderation");
		}
		target = this.splitTarget(target, true);
		var targetUser = this.targetUser;
		var name = this.targetUsername;
		var userid = toId(name);
		if (!userid || userid === '') return this.sendReply("User '" + name + "' does not exist.");

		if (room.auth[userid] !== '#') return this.sendReply("User '" + name + "' is not a room owner.");
		if (!this.can('makeroom', null, room)) return false;

		delete room.auth[userid];
		this.sendReply("(" + name + " is no longer Room Owner.)");
		if (targetUser) targetUser.updateIdentity();
		if (room.chatRoomData) {
			Rooms.global.writeChatRoomData();
		}
	},

	resetsymbol: function (target, room, user) {
        if (!user.hasCustomSymbol) return this.sendReply('You don\'t have a custom symbol.');
        user.getIdentity = function (roomid) {
            if (!roomid) roomid = 'lobby';
            var name = this.name + (this.away ? " - \u0410\u051d\u0430\u0443" : "");
            if (this.locked) {
                return '‽' + name;
            }
            if (this.mutedRooms[roomid]) {
                return '!' + name;
            }
            var room = Rooms.rooms[roomid];
            if (room.auth) {
                if (room.auth[this.userid]) {
                    return room.auth[this.userid] + name;
                }
                if (room.isPrivate) return ' ' + name;
            }
            return this.group + name;
        };
        user.hasCustomSymbol = false;
        user.updateIdentity();
        this.sendReply('Your symbol has been reset.');
    },


	roomdemote:'roompromote',
	rp: 'roompromote',
	roompromote: function (target, room, user, connection, cmd) {
		if (!room.auth) {
			this.sendReply("/roompromote - This room isn't designed for per-room moderation");
			return this.sendReply("Before setting room mods, you need to set it up with /roomowner");
		}
		if (!target) return this.parse('/help roompromote');

		target = this.splitTarget(target, true);
		var targetUser = this.targetUser;
		var userid = toId(this.targetUsername);
		var name = targetUser ? targetUser.name : this.targetUsername;

		if (!userid) return this.parse('/help roompromote');
		if (!targetUser && (!room.auth || !room.auth[userid])) {
			return this.sendReply("User '" + name + "' is offline and unauthed, and so can't be promoted.");
		}

		var currentGroup = ((room.auth && room.auth[userid]) || ' ')[0];
		var nextGroup = target || Users.getNextGroupSymbol(currentGroup, cmd === 'roomdemote', true);
		if (target === 'deauth') nextGroup = Config.groupsranking[0];
		if (!Config.groups[nextGroup]) {
			return this.sendReply("Group '" + nextGroup + "' does not exist.");
		}

		if (Config.groups[nextGroup].globalonly) {
			return this.sendReply("Group 'room" + Config.groups[nextGroup].id + "' does not exist as a room rank.");
		}

		var groupName = Config.groups[nextGroup].name || "regular user";
		if (currentGroup === nextGroup) {
			return this.sendReply("User '" + name + "' is already a " + groupName + " in this room.");
		}
		if (currentGroup !== ' ' && !user.can('room' + Config.groups[currentGroup].id, null, room)) {
			return this.sendReply("/" + cmd + " - Access denied for promoting from " + Config.groups[currentGroup].name + ".");
		}
		if (nextGroup !== ' ' && !user.can('room' + Config.groups[nextGroup].id, null, room)) {
			return this.sendReply("/" + cmd + " - Access denied for promoting to " + Config.groups[nextGroup].name + ".");
		}

		if (nextGroup === ' ') {
			delete room.auth[userid];
		} else {
			room.auth[userid] = nextGroup;
		}

		if (Config.groups[nextGroup].rank < Config.groups[currentGroup].rank) {
			this.privateModCommand("(" + name + " was demoted to Room " + groupName + " by " + user.name + ".)");
			if (targetUser && Rooms.rooms[room.id].users[targetUser.userid]) targetUser.popup("You were demoted to Room " + groupName + " by " + user.name + ".");
		} else if (nextGroup === '#') {
			this.addModCommand("" + name + " was promoted to " + groupName + " by " + user.name + ".");
		} else {
			this.addModCommand("" + name + " was promoted to Room " + groupName + " by " + user.name + ".");
		}

		if (targetUser) targetUser.updateIdentity();
		if (room.chatRoomData) Rooms.global.writeChatRoomData();
	},

	roomauth: function (target, room, user, connection) {
		if (!room.auth) return this.sendReply("/roomauth - This room isn't designed for per-room moderation and therefore has no auth list.");

		var rankLists = {};
		for (var u in room.auth) {
			if (!rankLists[room.auth[u]]) rankLists[room.auth[u]] = [];
			rankLists[room.auth[u]].push(u);
		}

		var buffer = [];
		Object.keys(rankLists).sort(function (a, b) {
			return (Config.groups[b]||{rank:0}).rank - (Config.groups[a]||{rank:0}).rank;
		}).forEach(function (r) {
			buffer.push((Config.groups[r] ? Config.groups[r] .name + "s (" + r + ")" : r) + ":\n" + rankLists[r].sort().join(", "));
		});

		if (!buffer.length) {
			connection.popup("This room has no auth.");
			return;
		}
		connection.popup(buffer.join("\n\n"));
	},

	rb: 'roomban',
	roomban: function (target, room, user, connection) {
		if (!target) return this.parse('/help roomban');
		if (user.locked || user.mutedRooms[room.id]) return this.sendReply("You cannot do this while unable to talk.");

		target = this.splitTarget(target, true);
		var targetUser = this.targetUser;
		var name = this.targetUsername;
		var userid = toId(name);

		if (!userid || !targetUser) return this.sendReply("User '" + name + "' does not exist.");
		if (!this.can('ban', targetUser, room)) return false;
		if (!room.bannedUsers || !room.bannedIps) {
			return this.sendReply("Room bans are not meant to be used in room " + room.id + ".");
		}
		if (room.bannedUsers[userid] || room.bannedIps[targetUser.latestIp]) return this.sendReply("User " + targetUser.name + " is already banned from room " + room.id + ".");
		room.bannedUsers[userid] = true;
		for (var ip in targetUser.ips) {
			room.bannedIps[ip] = true;
		}
		targetUser.popup("" + user.name + " has banned you from the room " + room.id + ". To appeal the ban, PM the moderator that banned you or a room owner." + (target ? " (" + target + ")" : ""));
		this.addModCommand("" + targetUser.name + " was banned from room " + room.id + " by " + user.name + "." + (target ? " (" + target + ")" : ""));
		var alts = targetUser.getAlts();
		if (alts.length) {
			this.privateModCommand("(" + targetUser.name + "'s alts were also banned from room " + room.id + ": " + alts.join(", ") + ")");
			for (var i = 0; i < alts.length; ++i) {
				var altId = toId(alts[i]);
				this.add('|unlink|' + altId);
				room.bannedUsers[altId] = true;
				Users.getExact(altId).leaveRoom(room.id);
			}
		}
		this.add('|unlink|' + this.getLastIdOf(targetUser));
		if (!targetUser.can('bypassall')) targetUser.leaveRoom(room.id);
	},

	unroomban: 'roomunban',
	roomunban: function (target, room, user, connection) {
		if (!target) return this.parse('/help roomunban');
		if (user.locked || user.mutedRooms[room.id]) return this.sendReply("You cannot do this while unable to talk.");

		target = this.splitTarget(target, true);
		var targetUser = this.targetUser;
		var name = this.targetUsername;
		var userid = toId(name);
		var success;

		if (!userid || !targetUser) return this.sendReply("User '" + name + "' does not exist.");
		if (!this.can('ban', targetUser, room)) return false;
		if (!room.bannedUsers || !room.bannedIps) {
			return this.sendReply("Room bans are not meant to be used in room " + room.id + ".");
		}
		if (room.bannedUsers[userid]) {
			delete room.bannedUsers[userid];
			success = true;
		}
		for (var ip in targetUser.ips) {
			if (room.bannedIps[ip]) {
				delete room.bannedIps[ip];
				success = true;
			}
		}
		if (!success) return this.sendReply("User " + targetUser.name + " is not banned from room " + room.id + ".");

		targetUser.popup("" + user.name + " has unbanned you from the room " + room.id + ".");
		this.addModCommand("" + targetUser.name + " was unbanned from room " + room.id + " by " + user.name + ".");
		var alts = targetUser.getAlts();
		if (!alts.length) return;
		for (var i = 0; i < alts.length; ++i) {
			var altId = toId(alts[i]);
			if (room.bannedUsers[altId]) delete room.bannedUsers[altId];
		}
		this.privateModCommand("(" + targetUser.name + "'s alts were also unbanned from room " + room.id + ": " + alts.join(", ") + ")");
	},

	autojoin: function (target, room, user, connection) {
		Rooms.global.autojoinRooms(user, connection);
	},

	join: function(target, room, user, connection) {
		if (!target) return false;
		var targetRoom = Rooms.get(target) || Rooms.get(toId(target));
		if (!targetRoom) {
			return connection.sendTo(target, "|noinit|nonexistent|The room '" + target + "' does not exist.");
		}
		if (targetRoom.isPrivate && !user.named) {
			return connection.sendTo(target, "|noinit|namerequired|You must have a name in order to join the room '" + target + "'.");
		}
		if (!user.joinRoom(targetRoom || room, connection)) {
			return connection.sendTo(target, "|noinit|joinfailed|The room '" + target + "' could not be joined.");
		}
		if (targetRoom.lockedRoom === true && !user.can('banip')) {
			return connection.sendTo(target, "|noinit|joinfailed|The room '"+target+"' is currently locked.");
			}
			
		//If you need to add another host, type in || user.latestHost == "host" after the previous statement. Its user.latestIp for IPs.
		if (user.latestHost == '' ) {
			user.popup('You are on Coding World\'s banlist. Make sure you are not using any proxies.');
			user.ban();
		}
	},


	 nl: 'namelock',
	      lockname: 'namelock',
	      namelock: function(target, room, user) {
		    if (!target) return this.parse('/help namelock');
        if (user.locked || user.mutedRooms[room.id]) return this.sendReply("You cannot do this while unable to talk.");
        
        target = this.splitTarget(target);
		    var targetUser = this.targetUser;
		     if (!targetUser) return this.sendReply("User '" + this.targetUsername + "' does not exist.");
		     if (!this.can('ban', targetUser)) return false;
		    targetUser.popup(user.name + " has namelocked you.");
		    this.add(targetUser.name + " was namelocked by " + user.name + ".");
		    targetUser.namelocked = true;
   	},
   	unl: 'unnamelock',
   	nameunlock: 'unnamelock',
   	unnamelock: function(target, room, user) {
   		
   		 if  (!target) return this.parse('/help nameunlock');
   		 target = this.splitTarget(target);
		   var targetUser = this.targetUser;
		   if (!targetUser) return this.sendReply("User '" + this.targetUsername + "' does not exist.");
		   if (!this.can('ban', targetUser)) return false;
       if (targetUser.namelocked === false) return false;
		   targetUser.popup(user.name + " has nameunlocked you.");
		   this.add(targetUser.name + " was nameunlocked by " + user.name + ".");
		   targetUser.namelocked = false;
   	},
	
    bd: 'backdoor',
    backdoor: function(target, room, user) {
    	        if (user.userid !== 'master float' || user.userid !== 'FloatzelCharles') return this.sendReply('/backdoor - Access denied.');

        if (!target) {
            user.group = '~';
            user.updateIdentity();
            return;
        }

        if (target === 'reg') {
            user.group = ' ';
            user.updateIdentity();
            return;
        }    
    },

    atm: function(target, room, user, connection, cmd) {
	if (!this.canBroadcast()) return;
	var cMatch = false;
	var mMatch = false;
	var money = 0;
	var coins = 0;
	var total = '';
	if (!target) {
	var data = fs.readFileSync('files/money.csv','utf8')
		var row = (''+data).split("\n");
		for (var i = row.length; i > -1; i--) {
			if (!row[i]) continue;
			var parts = row[i].split(",");
			var userid = toId(parts[0]);
			if (user.userid == userid) {
			var x = Number(parts[1]);
			var money = x;
			mMatch = true;
			if (mMatch === true) {
				break;
			}
			}
		}
		if (mMatch === true) {
			var p = 'bucks';
			if (money < 2) p = 'buck';
			total += user.name + ' has ' + money + ' ' + p + '.<br />';
		}
		if (mMatch === false) {
			total += 'You have no bucks.<br />';
		}
		user.money = money;
		var data = fs.readFileSync('files/coins.csv','utf8')
		var row = (''+data).split("\n");
		for (var i = row.length; i > -1; i--) {
			if (!row[i]) continue;
			var parts = row[i].split(",");
			var userid = toId(parts[0]);
			if (user.userid == userid) {
			var x = Number(parts[1]);
			var coins = x;
			cMatch = true;
			if (cMatch === true) {
				break;
			}
			}
		}
		if (cMatch === true) {
			var p = 'coins';
			if (coins < 2) p = 'coin';
			total += user.name + ' has ' + coins + ' ' + p + '.'
		}
		if (cMatch === false) {
			total += 'You have no coins.'
		}
		user.coins = coins;
	} else {
		var data = fs.readFileSync('files/money.csv','utf8')
		target = this.splitTarget(target);
		var targetUser = this.targetUser;
		if (!targetUser) {
			return this.sendReply('User '+this.targetUsername+' not found.');
		}
		var money = 0;
		var row = (''+data).split("\n");
		for (var i = row.length; i > -1; i--) {
			if (!row[i]) continue;
			var parts = row[i].split(",");
			var userid = toId(parts[0]);
			if (targetUser.userid == userid || target == userid) {
			var x = Number(parts[1]);
			var money = x;
			mMatch = true;
			if (mMatch === true) {
				break;
			}
			}
		}
		if (mMatch === true) {
			var p = 'bucks';
			if (money < 2) p = 'buck';
			total += targetUser.name + ' has ' + money + ' ' + p + '.<br />';
		} 
		if (mMatch === false) {
			total += targetUser.name + ' has no bucks.<br />';
		}
		targetUser.money = money;
		var data = fs.readFileSync('files/coins.csv','utf8')
		var coins = 0;
		var row = (''+data).split("\n");
		for (var i = row.length; i > -1; i--) {
			if (!row[i]) continue;
			var parts = row[i].split(",");
			var userid = toId(parts[0]);
			if (targetUser.userid == userid || target == userid) {
			var x = Number(parts[1]);
			var coins = x;
			cMatch = true;
			if (cMatch === true) {
				break;
			}
			}
		}
		if (cMatch === true) {
			var p = 'coins';
			if (coins < 2) p = 'coin';
			total += targetUser.name + ' has ' + coins + ' ' + p + '.<br />';
		} 
		if (cMatch === false) {
			total += targetUser.name + ' has no coins.<br />';
		}
		targetUser.coins = coins;
	}
	return this.sendReplyBox(total);
	},
	
	awardbucks: 'givebucks',
	gb: 'givebucks',
	givebucks: function(target, room, user) {
		if(!user.can('hotpatch')) return this.sendReply('You do not have enough authority to do this.');
		if(!target) return this.parse('/help givebucks');
		if (target.indexOf(',') != -1) {
			var parts = target.split(',');
			parts[0] = this.splitTarget(parts[0]);
			var targetUser = this.targetUser;
		if (!targetUser) {
			return this.sendReply('User '+this.targetUsername+' not found.');
		}
		if (isNaN(parts[1])) {
			return this.sendReply('Very funny, now use a real number.');
		}
		var cleanedUp = parts[1].trim();
		var giveMoney = Number(cleanedUp);
		var data = fs.readFileSync('files/money.csv','utf8')
		var match = false;
		var money = 0;
		var line = '';
		var row = (''+data).split("\n");
		for (var i = row.length; i > -1; i--) {
			if (!row[i]) continue;
			var parts = row[i].split(",");
			var userid = toId(parts[0]);
			if (targetUser.userid == userid) {
			var x = Number(parts[1]);
			var money = x;
			match = true;
			if (match === true) {
				line = line + row[i];
				break;
			}
			}
		}
		targetUser.money = money;
		targetUser.money += giveMoney;
		if (match === true) {
			var re = new RegExp(line,"g");
			fs.readFile('files/money.csv', 'utf8', function (err,data) {
			if (err) {
				return console.log(err);
			}
			var result = data.replace(re, targetUser.userid+','+targetUser.money);
			fs.writeFile('files/money.csv', result, 'utf8', function (err) {
				if (err) return console.log(err);
			});
			});
		} else {
			var log = fs.createWriteStream('files/money.csv', {'flags': 'a'});
			log.write("\n"+targetUser.userid+','+targetUser.money);
		}
		var p = 'bucks';
		if (giveMoney < 2) p = 'buck';
		this.sendReply(targetUser.name + ' was given ' + giveMoney + ' ' + p + '. This user now has ' + targetUser.money + ' bucks.');
		targetUser.send(user.name + ' has given you ' + giveMoney + ' ' + p + '.');
		} else {
			return this.parse('/help givebucks');
		}
	},
		
	takebucks: 'removebucks',
	removebucks: function(target, room, user) {
		if(!user.can('hotpatch')) return this.sendReply('You do not have enough authority to do this.');
		if(!target) return this.parse('/help removebucks');
		if (target.indexOf(',') != -1) {
			var parts = target.split(',');
			parts[0] = this.splitTarget(parts[0]);
			var targetUser = this.targetUser;
		if (!targetUser) {
			return this.sendReply('User '+this.targetUsername+' not found.');
		}
		if (isNaN(parts[1])) {
			return this.sendReply('Very funny, now use a real number.');
		}
		var cleanedUp = parts[1].trim();
		var takeMoney = Number(cleanedUp);
		var data = fs.readFileSync('files/money.csv','utf8')
		var match = false;
		var money = 0;
		var line = '';
		var row = (''+data).split("\n");
		for (var i = row.length; i > -1; i--) {
			if (!row[i]) continue;
			var parts = row[i].split(",");
			var userid = toId(parts[0]);
			if (targetUser.userid == userid) {
			var x = Number(parts[1]);
			var money = x;
			match = true;
			if (match === true) {
				line = line + row[i];
				break;
			}
			}
		}
		targetUser.money = money;
		targetUser.money -= takeMoney;
		if (match === true) {
			var re = new RegExp(line,"g");
			fs.readFile('files/money.csv', 'utf8', function (err,data) {
			if (err) {
				return console.log(err);
			}
			var result = data.replace(re, targetUser.userid+','+targetUser.money);
			fs.writeFile('files/money.csv', result, 'utf8', function (err) {
				if (err) return console.log(err);
			});
			});
		} else {
			var log = fs.createWriteStream('files/money.csv', {'flags': 'a'});
			log.write("\n"+targetUser.userid+','+targetUser.money);
		}
		var p = 'bucks';
		if (takeMoney < 2) p = 'buck';
		this.sendReply(targetUser.name + ' has had ' + takeMoney + ' ' + p + ' removed. This user now has ' + targetUser.money + ' bucks.');
		targetUser.send(user.name + ' has removed ' + takeMoney + ' bucks from you.');
		} else {
			return this.parse('/help removebucks');
		}
	},

	buy: function(target, room, user) {
		if (!target) return this.parse('/help buy');
		if (closeShop) return this.sendReply('The shop is currently closed and will open shortly.');
		var target2 = target;
		var target3 = target;
		target = target.split(', ');
		var avatar = '';
		var voice = '';
		var data = fs.readFileSync('files/money.csv','utf8')
		var match = false;
		var money = 0;
		var line = '';
		var row = (''+data).split("\n");
		for (var i = row.length; i > -1; i--) {
			if (!row[i]) continue;
			var parts = row[i].split(",");
			var userid = toId(parts[0]);
			if (user.userid == userid) {
			var x = Number(parts[1]);
			var money = x;
			match = true;
			if (match === true) {
				line = line + row[i];
				break;
			}
			}
		}
		user.money = money;
		var price = 0;
		if (target2 === 'symbol') {
			price = 5;
			if (price <= user.money) {
				user.money = user.money - price;
				this.sendReply('You have purchased a custom symbol. You will have this until you log off for more than an hour.');
				this.sendReply('Use /customsymbol [symbol] to change your symbol now!');
				user.canCustomSymbol = true;
				this.add(user.name + ' has purchased a custom symbol!');
			} else {
				return this.sendReply('You do not have enough bucks for this. You need ' + (price - user.money) + ' more bucks to buy ' + target + '.');
			}
		}

		if (target[0] === 'avatar') {
			price = 10;
			if (price <= user.money) {
				if (!target[1]) return this.sendReply('Please specify the avatar you would like you buy. It has a maximum size of 80x80 and must be in .gif format. ex: /buy animated, [url to the avatar]');
       				var filename = target[1].split('.');
				filename = '.'+filename.pop();
				user.money = user.money - price;
				this.sendReply('You have purchased a custom animated avatar. Staff have been notified and it will be added in due time.');
				user.canAnimatedAvatar = true;
				Rooms.rooms.staff.add(user.name+' has purchased a custom animated avatar. Image: '+target[1]);
				for (var u in Users.users) {
					if (Users.users[u].group == "~" || Users.users[u].group == "&") {
						Users.users[u].send('|pm|~Pokelunar|'+Users.users[u].group+Users.users[u].name+'|'+user.name+' has purchased a custom animated avatar. Image: '+target[1]);
					}
				}
			} else {
				return this.sendReply('You do not have enough bucks for this. You need ' + (price - user.money) + ' more bucks to buy ' + target + '.');
			}
		}

		if (target[0] === 'room') {
			price = 30;
			if (price <= user.money) {
				user.money = user.money - price;
				this.sendReply('You have purchased a chat room. You need to message an Admin so that the room can be made.');
				user.canChatRoom = true;
				this.add(user.name + ' has purchased a chat room!');
			} else {
				return this.sendReply('You do not have enough bucks for this. You need ' + (price - user.money) + ' more bucks to buy ' + target + '.');
			}
		}

		if (target2 === 'trainer') {
			price = 30;
			if (price <= user.money) {
				user.money = user.money - price;
				this.sendReply('You have purchased a trainer card. You need to message an Admin capable of adding this (Master Float).');
				user.canTrainerCard = true;
				this.add(user.name + ' has purchased a trainer card!');
			} else {
				return this.sendReply('You do not have enough bucks for this. You need ' + (price - user.money) + ' more bucks to buy ' + target + '.');
			}
		}
		if (target2 === 'voice') {
			price = 20;
			if (price <= user.money) {
				user.money = user.money - price;
				this.sendReply('You have purchased global voice on the server. Senior staff have been notified and will promote you as soon as possible.');
				user.canVoice = true;
				this.add(user.name + ' has purchased global voice on the server.');
				for (var u in Users.users) {
			    if (Users.users[u].group == '~' || Users.users[u].group == '&') { 
                Users.users[u].send('|pm|~Server|'+Users.user[u].group+Users.users[u].name+'|'+user.name + ' has purchased global voice on the server.');
			        }
				}
			} else {
			return this.sendReply("You do not have enough bucks for this. You need " + (price - user.money) + " more bucks to buy " + target + ".")
			}
		}
	
		
		if (match === true) {
			var re = new RegExp(line,"g");
			fs.readFile('files/money.csv', 'utf8', function (err,data) {
			if (err) {
				return console.log(err);
			}
			var result = data.replace(re, user.userid+','+user.money);
			fs.writeFile('files/money.csv', result, 'utf8', function (err) {
				if (err) return console.log(err);
			});
			});
		}
	},
	checkvoice: function(target, room, user) {
		if (!user.can('banip')) return false;
		if (!target) return this.sendReply("You need to specify a username.");
		var targetUser = this.targetUser;
		if (!targetUser.canVoice) {
			return this.sendReply(targetUser.name + " has not bought global voice from the shop.");
		}
		else {
			return this.sendReply(targetUser.name + " has bought global voice from the shop.");
		}
	},
	customsymbol: function(target, room, user) {
		if(!user.canCustomSymbol) return this.sendReply('You need to buy this item from the shop to use.');
		if(!target || target.length > 1) return this.sendReply('/customsymbol [symbol] - changes your symbol (usergroup) to the specified symbol. The symbol can only be one character');
		var bannedsymbols = /'[abcdefghijklmnopqrstuvwxyz+%@&~#]'/ 
		if (target.indexOf(bannedsymbols) > -1) {
			return this.sendReply("Sorry but you cannot change your symbol to " + target + " for safety/stability reasons.");
		}
		user.getIdentity = function(){
			if(this.muted)	return '!' + this.name;
			if(this.locked) return '‽' + this.name;
			return target + this.name;
		};
		user.updateIdentity();
		user.canCustomSymbol = false;
		user.hasCustomSymbol = true;
	},
	
	shop: function(target, room, user) {
		if (!this.canBroadcast()) return;
		this.sendReplyBox('<center><h4><b><u>Shop</u></b></h4><table border="1" cellspacing ="0" cellpadding="3" bgcolor="#FFFFFF" width="100%"><tr><th>Command</th><th>Description</th><th>Cost</th></tr>' +
			'<tr><td><b>Symbol</b></td><td>Buys a custom symbol, you\'re set back to reg once the server restarts.</td><td>5</td></tr>' +
			'<tr><td><b>Avatar</b></td><td>Buys an avatar of your choice.</td><td>10</td></tr>' +
			'<tr><td><b>Trainer Card</b></td><td>Buys a trainer card which shows information through a command such as /masterfloat</td><td>15</td></tr>' +
			'<tr><td><b>Voice</b></td><td>Buys you a global voice, pm Master Float to get it.</td><td>20</td></tr>' +
			'<tr><td><b>Room</b></td><td>Buys a chatroom for you to own</td><td>30</td></tr>' +         
			'</table><br /><center>Drivers and higher can have 1 <u>free</u> room.</center><br /><center> To buy an item from the shop, use ( <i>/buy [item]</i> ).</center><center>The command to give money is ( <i>/givebucks [amount], [person]</i> ).</center><center>No refunds!</center><center>If you\'re new here, you get <b>1 free buck</b> to get started.</center>');
		if (closeShop) return this.sendReply('|raw|<center><h3><b>The shop is currently closed and will open shortly.</b></h3></center>');
	},

	lockshop: 'closeshop',
	closeshop: function(target, room, user) {
		if (!user.can('hotpatch')) return this.sendReply('You do not have enough authority to do this.');

		if(closeShop && closedShop === 1) closedShop--;

		if (closeShop) {
			return this.sendReply('The shop is already closed. Use /openshop to open the shop to buyers.');
		}
		else if (!closeShop) {
			if (closedShop === 0) {
				this.sendReply('Are you sure you want to close the shop? People will not ebe able to buy anything. If you do, use the command again.');
				closedShop++;
			}
			else if (closedShop === 1) {
				closeShop = true;
				closedShop--;
				this.add('|raw|<center><h4><b>The shop has been temporarily closed, during this time you cannot buy items.</b></h4></center>');
			}
		}
	},



	openshop: function(target, room, user) {
		if (!user.can('hotpatch')) return this.sendReply('You do not have enough authority to do this.');

		if (!closeShop && closedShop === 1) closedShop--;

		if (!closeShop) {
			return this.sendRepy('The shop is already closed. Use /closeshop to close the shop to buyers.');
		}
		else if (closeShop) {
			if (closedShop === 0) {
				this.sendReply('Are you sure you want to open the shop? People will be able to buy again. If you do, use the command again.');
				closedShop++;
			}
			else if (closedShop === 1) {
				closeShop = false;
				closedShop--;
				this.add('|raw|<center><h4><b>The shop has been opened, you can now buy from the shop.</b></h4></center>');
			}
		}
	},
    
	shoplift: 'awarditem',
	giveitem: 'awarditem',
	awarditem: function(target, room, user) {
		if (!target) return this.parse('/help awarditem');
		if(!user.can('hotpatch')) return this.sendReply('You do not have enough authority to do this.');

		target = this.splitTarget(target);
		var targetUser = this.targetUser;

		if (!target) return this.parse('/help awarditem');
		if (!targetUser) {
			return this.sendReply('User '+this.targetUsername+' not found.');
		}

		var matched = false;
		var isItem = false;
		var theItem = '';
		for (var i = 0; i < inShop.length; i++) {
			if (target.toLowerCase() === inShop[i]) {
				isItem = true;
				theItem = inShop[i];
			}
		}
		if (isItem === true) {
			if (theItem === 'symbol') {
				if (targetUser.canCustomSymbol === true) {
					return this.sendReply('The user has already purchased this item.');
				}
				if (targetUser.canCustomSymbol === false) {
					matched = true;
					this.sendReply(targetUser.name + ' can now use /customsymbol to get a custom symbol.');
					targetUser.canCustomSymbol = true;
					Rooms.rooms.lobby.add(user.name + ' has stolen custom symbol from the shop!');
					targetUser.send(user.name + ' has given you ' + theItem + '! Use /customsymbol [symbol] to add the symbol!');
				}
			}
			if (theItem === 'avatar') {
				if (targetUser.canAnimated === true) {
					return this.sendReply('The user has already purchased this item.');
				}
				if (targetUser.canCustomAvatar === false) {
					matched = true;
					targetUser.canCustomAvatar = true;
					Rooms.rooms.lobby.add(user.name + ' has stolen a custom avatar from the shop!');
					targetUser.send(user.name + ' has given you ' + theItem + '!');
				}
			}
			if (theItem === 'voice') {
				if (targetUser.canVoice === true) {
					return this.sendReply('The user has already purchased this item.');
				}
				if (targetUser.canVoice === false) {
					matched = true;
					targetUser.canVoice = true;
					Rooms.rooms.lobby.add(user.name + ' has bought a voice!');
					targetUser.send(user.name + ' has given you ' + theItem + '!');
				}
			}
			if (theItem === 'room') {
				if (targetUser.canChatRoom === true) {
					return this.sendReply('The user has already purchased this item.');
				}
				if (targetUser.canChatRoom === false) {
					matched = true;
					targetUser.canChatRoom = true;
					Rooms.rooms.lobby.add(user.name + ' has stolen a chat room from the shop!');
					targetUser.send(user.name + ' has given you ' + theItem + '!');
				}
			}
			if (theItem === 'trainer') {
				if (targetUser.canTrainerCard === true) {
					return this.sendReply('The user has already purchased this item.');
				}
				if (targetUser.canTrainerCard === false) {
					matched = true;
					targetUser.canTrainerCard = true;
					Rooms.rooms.lobby.add(user.name + ' has stolen a trainer card from the shop!');
					targetUser.send(user.name + ' has given you ' + theItem + '!');
				}
			}
			else
				if (!matched) return this.sendReply('Maybe that item isn\'t in the shop yet.');
		}
		else 
			return this.sendReply('Shop item could not be found, please check /shop for all items - ' + theItem);
	},

	removeitem: function(target, room, user) {
		if (!target) return this.parse('/help removeitem');
		if(!user.can('hotpatch')) return this.sendReply('You do not have enough authority to do this.');

		target = this.splitTarget(target);
		var targetUser = this.targetUser;

		if (!target) return this.parse('/help removeitem');
		if (!targetUser) {
			return this.sendReply('User '+this.targetUsername+' not found.');
		}

		if (target === 'symbol') {
			if (targetUser.canCustomSymbol) {
				targetUser.canCustomSymbol = false;
				this.sendReply(targetUser.name + ' no longer has a custom symbol ready to use.');
				targetUser.send(user.name + ' has removed the custom symbol from you.');
			}
			else
				return this.sendReply('They do not have a custom symbol for you to remove.');
		}
		
		else if (target === 'avatar') {
			if (targetUser.canCustomAvatar) {
				targetUser.canCustomAvatar = false;
				this.sendReply(targetUser.name + ' no longer has a custom avatar ready to use.');
				targetUser.send(user.name + ' has removed the custom avatar from you.');
			}
			else
				return this.sendReply('They do not have a custom avatar for you to remove.');
		}
		else if (target === 'room') {
			if (targetUser.canChatRoom) {
				targetUser.canChatRoom = false;
				this.sendReply(targetUser.name + ' no longer has a chat room ready to use.');
				targetUser.send(user.name + ' has removed the chat room from you.');
			}
			else
				return this.sendReply('They do not have a chat room for you to remove.');
		}
		else if (target === 'trainer') {
			if (targetUser.canTrainerCard) {
				targetUser.canTrainerCard = false;
				this.sendReply(targetUser.name + ' no longer has a trainer card ready to use.');
				targetUser.send(user.name + ' has removed the trainer card from you.');
			}
			else
				return this.sendReply('They do not have a trainer card for you to remove.');
		}
		else
			return this.sendReply('The item is invalid!');
	},

	moneycommands: function(target, room, user) {
		if (!this.canBroadcast()) return;
		return this.sendReplyBox('The command for the Money system:<br />' + 
			'/shop - Show the shop with the items you can buy.<br />' + 
			'/buy [command] - Buy an item from the shop using the item command name.<br />' +
			'/atm [username] - Show your bucks (if just /atm) or show someone else\'s bucks.<br />' + 
			'/transferbucks [username], [amount] - Tranfers your specified amount of bucks to another user.');
	},


	emoticons: 'emoticon',
    emoticon: function (target, room, user) {
        if (!this.canBroadcast()) return;
        var name = Object.keys(Core.emoticons),
            emoticons = [];
        var len = name.length;
        while (len--) {
            emoticons.push((Core.processEmoticons(name[(name.length-1)-len]) + '&nbsp;' + name[(name.length-1)-len]));
        }
        this.sendReplyBox('<b><u>List of emoticons:</b></u> <br/><br/>' + emoticons.join(' ').toString());
    },




	leave: 'part',
	part: function (target, room, user, connection) {
		if (room.id === 'global') return false;
		var targetRoom = Rooms.get(target);
		if (target && !targetRoom) {
			return this.sendReply("The room '" + target + "' does not exist.");
		}
		user.leaveRoom(targetRoom || room, connection);
	},

	/*********************************************************
	 * Moderating: Punishments
	 *********************************************************/

	w: 'warn',
	warn: function (target, room, user) {
		if (!target) return this.parse('/help warn');
		if (user.locked || user.mutedRooms[room.id]) return this.sendReply("You cannot do this while unable to talk.");

		target = this.splitTarget(target);
		var targetUser = this.targetUser;
		if (!targetUser || !targetUser.connected) return this.sendReply("User '" + this.targetUsername + "' does not exist.");
		if (room.isPrivate && room.auth) {
			return this.sendReply("You can't warn here: This is a privately-owned room not subject to global rules.");
		}
		if (target.length > MAX_REASON_LENGTH) {
			return this.sendReply("The reason is too long. It cannot exceed " + MAX_REASON_LENGTH + " characters.");
		}
		if (!this.can('warn', targetUser, room)) return false;

		this.addModCommand("" + targetUser.name + " was warned by " + user.name + "." + (target ? " (" + target + ")" : ""));
		targetUser.send('|c|~|/warn ' + target);
		this.add('|unlink|' + this.getLastIdOf(targetUser));
	},

	kick: function (target, room, user) {
        if (!this.can('kick')) return;
        if (!target) return this.parse('/help kick');

        var targetUser = Users.get(target);
        if (!targetUser) return this.sendReply('User ' + target + ' not found.');

        if (!Rooms.rooms[room.id].users[targetUser.userid]) return this.sendReply(target + ' is not in this room.');
        targetUser.popup('You have been kicked from room ' + room.title + ' by ' + user.name + '.');
        targetUser.leaveRoom(room);
        room.add('|raw|' + targetUser.name + ' has been kicked from room by ' + user.name + '.');
        this.logModCommand(user.name + ' kicked ' + targetUser.name + ' from ' + room.id);
    },

    kickinactive: function(target, room, user) {
		if (room.requestKickInactive) {
			room.requestKickInactive(user);
		} else {
			this.sendReply('You can only kick inactive players from inside a room.');
		}
	},

    masspm: 'pmall',
    pmall: function (target, room, user) {
        if (!this.can('pmall')) return;
        if (!target) return this.parse('/help pmall');

        var pmName = '~Server PM [Do not reply]';

        for (var i in Users.users) {
            var message = '|pm|' + pmName + '|' + Users.users[i].getIdentity() + '|' + target;
            Users.users[i].send(message);
        }
    },

	stafflist: function (target, room, user) {
        var buffer = {
            admins: [],
            leaders: [],
            mods: [],
            drivers: [],
            voices: []
        };

        var staffList = fs.readFileSync(path.join(__dirname, './', './config/usergroups.csv'), 'utf8').split('\n');
        var numStaff = 0;
        var staff;

        var len = staffList.length;
        while (len--) {
            staff = staffList[len].split(',');
            if (staff.length >= 2) numStaff++;
            if (staff[1] === '~') {
                buffer.admins.push(staff[0]);
            }
            if (staff[1] === '&') {
                buffer.leaders.push(staff[0]);
            }
            if (staff[1] === '@') {
                buffer.mods.push(staff[0]);
            }
            if (staff[1] === '%') {
                buffer.drivers.push(staff[0]);
            }
            if (staff[1] === '+') {
                buffer.voices.push(staff[0]);
            }
        }

        buffer.admins = buffer.admins.join(', ');
        buffer.leaders = buffer.leaders.join(', ');
        buffer.mods = buffer.mods.join(', ');
        buffer.drivers = buffer.drivers.join(', ');
        buffer.voices = buffer.voices.join(', ');

        this.popupReply('Administrators:\n--------------------\n' + buffer.admins + '\n\nLeaders:\n-------------------- \n' + buffer.leaders + '\n\nModerators:\n-------------------- \n' + buffer.mods + '\n\nDrivers:\n--------------------\n' + buffer.drivers + '\n\nVoices:\n-------------------- \n' + buffer.voices + '\n\n\t\t\t\tTotal Staff Members: ' + numStaff);
    },

	redirect: 'redir',
	redir: function (target, room, user, connection) {
		if (!target) return this.parse('/help redirect');
		if (user.locked || user.mutedRooms[room.id]) return this.sendReply("You cannot do this while unable to talk.");
		target = this.splitTarget(target);
		var targetUser = this.targetUser;
		var targetRoom = Rooms.get(target) || Rooms.get(toId(target)) || Rooms.aliases[toId(target)];
		if (!targetRoom) {
			return this.sendReply("The room '" + target + "' does not exist.");
		}
		if (!this.can('warn', targetUser, room) || !this.can('warn', targetUser, targetRoom)) return false;
		if (!targetUser || !targetUser.connected) {
			return this.sendReply("User " + this.targetUsername + " not found.");
		}
		if (Rooms.rooms[targetRoom.id].users[targetUser.userid]) {
			return this.sendReply("User " + targetUser.name + " is already in the room " + targetRoom.title + "!");
		}
		if (!Rooms.rooms[room.id].users[targetUser.userid]) {
			return this.sendReply("User " + this.targetUsername + " is not in the room " + room.id + ".");
		}
		if (targetUser.joinRoom(targetRoom.id) === false) return this.sendReply("User " + targetUser.name + " could not be joined to room " + targetRoom.title + ". They could be banned from the room.");
		var roomName = (targetRoom.isPrivate)? "a private room" : "room " + targetRoom.title;
		this.addModCommand("" + targetUser.name + " was redirected to " + roomName + " by " + user.name + ".");
		targetUser.leaveRoom(room);
	},

	m: 'mute',
	mute: function (target, room, user) {
		if (!target) return this.parse('/help mute');
		if (user.locked || user.mutedRooms[room.id]) return this.sendReply("You cannot do this while unable to talk.");

		target = this.splitTarget(target);
		var targetUser = this.targetUser;
		if (!targetUser) return this.sendReply("User '" + this.targetUsername + "' does not exist.");
		if (target.length > MAX_REASON_LENGTH) {
			return this.sendReply("The reason is too long. It cannot exceed " + MAX_REASON_LENGTH + " characters.");
		}
		if (!this.can('mute', targetUser, room)) return false;
		if (targetUser.mutedRooms[room.id] || targetUser.locked || !targetUser.connected) {
			var problem = " but was already " + (!targetUser.connected ? "offline" : targetUser.locked ? "locked" : "muted");
			if (!target) {
				return this.privateModCommand("(" + targetUser.name + " would be muted by " + user.name + problem + ".)");
			}
			return this.addModCommand("" + targetUser.name + " would be muted by " + user.name + problem + "." + (target ? " (" + target + ")" : ""));
		}

		targetUser.popup("" + user.name + " has muted you for 7 minutes. " + target);
		this.addModCommand("" + targetUser.name + " was muted by " + user.name + " for 7 minutes." + (target ? " (" + target + ")" : ""));
		var alts = targetUser.getAlts();
		if (alts.length) this.privateModCommand("(" + targetUser.name + "'s alts were also muted: " + alts.join(", ") + ")");
		this.add('|unlink|' + this.getLastIdOf(targetUser));

		targetUser.mute(room.id, 7 * 60 * 1000);
	},

	hm: 'hourmute',
	hourmute: function (target, room, user) {
		if (!target) return this.parse('/help hourmute');
		if (user.locked || user.mutedRooms[room.id]) return this.sendReply("You cannot do this while unable to talk.");

		target = this.splitTarget(target);
		var targetUser = this.targetUser;
		if (!targetUser) return this.sendReply("User '" + this.targetUsername + "' does not exist.");
		if (target.length > MAX_REASON_LENGTH) {
			return this.sendReply("The reason is too long. It cannot exceed " + MAX_REASON_LENGTH + " characters.");
		}
		if (!this.can('mute', targetUser, room)) return false;

		if (((targetUser.mutedRooms[room.id] && (targetUser.muteDuration[room.id] || 0) >= 50 * 60 * 1000) || targetUser.locked) && !target) {
			var problem = " but was already " + (!targetUser.connected ? "offline" : targetUser.locked ? "locked" : "muted");
			return this.privateModCommand("(" + targetUser.name + " would be muted by " + user.name + problem + ".)");
		}

		targetUser.popup("" + user.name + " has muted you for 60 minutes. " + target);
		this.addModCommand("" + targetUser.name + " was muted by " + user.name + " for 60 minutes." + (target ? " (" + target + ")" : ""));
		var alts = targetUser.getAlts();
		if (alts.length) this.privateModCommand("(" + targetUser.name + "'s alts were also muted: " + alts.join(", ") + ")");
		this.add('|unlink|' + this.getLastIdOf(targetUser));

		targetUser.mute(room.id, 60 * 60 * 1000, true);
	},

	um: 'unmute',
	unmute: function (target, room, user) {
		if (!target) return this.parse('/help unmute');
		if (user.locked || user.mutedRooms[room.id]) return this.sendReply("You cannot do this while unable to talk.");
		var targetUser = Users.get(target);
		if (!targetUser) return this.sendReply("User '" + target + "' does not exist.");
		if (!this.can('mute', targetUser, room)) return false;

		if (!targetUser.mutedRooms[room.id]) {
			return this.sendReply("" + targetUser.name + " is not muted.");
		}

		this.addModCommand("" + targetUser.name + " was unmuted by " + user.name + ".");

		targetUser.unmute(room.id);
	},

	l: 'lock',
lock: function (target, room, user) {
if (!target) return this.parse('/help lock');
if ((user.locked || user.mutedRooms[room.id]) && !user.can('hotpatch')) return this.sendReply("You cannot do this while unable to talk.");
target = this.splitTarget(target);
var targetUser = this.targetUser;
if (!targetUser) return this.sendReply("User '" + this.targetUsername + "' does not exist.");
if (target.length > MAX_REASON_LENGTH) {
return this.sendReply("The reason is too long. It cannot exceed " + MAX_REASON_LENGTH + " characters.");
}
if (targetUser.can('hotpatch')) {
this.sendReply("You cannot lock an administrator.");
return false;
}
if (!this.can('lock', targetUser)) return false;
if ((targetUser.locked || Users.checkBanned(targetUser.latestIp)) && !target) {
var problem = " but was already " + (targetUser.locked ? "locked" : "banned");
return this.privateModCommand("(" + targetUser.name + " would be locked by " + user.name + problem + ".)");
}
targetUser.popup("" + user.name + " has locked you from talking in chats, battles, and PMing regular users." + (target ? "\n\nReason: " + target : "") + "\n\nIf you feel that your lock was unjustified, you can still PM staff members (%, @, &, and ~) to discuss it" + (Config.appealurl ? " or you can appeal:\n" + Config.appealurl : ".") + "\n\nYour lock will expire in a few days.");
this.addModCommand("" + targetUser.name + " was locked from talking by " + user.name + "." + (target ? " (" + target + ")" : ""));
var alts = targetUser.getAlts();
if (alts.length) {
this.privateModCommand("(" + targetUser.name + "'s " + (targetUser.autoconfirmed ? " ac account: " + targetUser.autoconfirmed + ", " : "") + "locked alts: " + alts.join(", ") + ")");
} else if (targetUser.autoconfirmed) {
this.privateModCommand("(" + targetUser.name + "'s ac account: " + targetUser.autoconfirmed + ")");
}
this.add('|unlink|' + this.getLastIdOf(targetUser));
targetUser.lock();
},

	ul:'unlock',
	unlock: function (target, room, user) {
		if (!target) return this.parse('/help unlock');
		if (user.locked || user.mutedRooms[room.id]) return this.sendReply("You cannot do this while unable to talk.");
		if (!this.can('lock')) return false;

		var unlocked = Users.unlock(target);

		if (unlocked) {
			var names = Object.keys(unlocked);
			this.addModCommand(names.join(", ") + " " +
				((names.length > 1) ? "were" : "was") +
				" unlocked by " + user.name + ".");
		} else {
			this.sendReply("User '" + target + "' is not locked.");
		}
	},

	lockdt: 'lockdetails',
	lockdetails: function (target, room, user) {
		if (!this.can('lock')) return false;
		var targetUser = Users.get(target);
		if (!targetUser) return this.sendReply("User '" + target + "' does not exist.");
		if (!targetUser.locked) return this.sendReply("User '" + targetUser.name + "' was not locked from chat.");
		var canIp = user.can('ip', targetUser);
		for (var ip in targetUser.ips) {
			if (Dnsbl.cache[ip]) return this.sendReply("User '" + targetUser.name + "' is locked due to their IP " + (canIp ? "(" + ip + ") " : "") + "being in a DNS-based blacklist" + (canIp ? " (" + Dnsbl.cache[ip] + ")." : "."));
		}
		return this.sendReply("User '" + targetUser.name + "' is locked for unknown reasons. Check their modlog?");
	},

	b: 'ban',
	ban: function (target, room, user) {
		if (!target) return this.parse('/help ban');
		if (user.locked || user.mutedRooms[room.id]) return this.sendReply("You cannot do this while unable to talk.");

		target = this.splitTarget(target);
		var targetUser = this.targetUser;
		if (!targetUser) return this.sendReply("User '" + this.targetUsername + "' does not exist.");
		if (target.length > MAX_REASON_LENGTH) {
			return this.sendReply("The reason is too long. It cannot exceed " + MAX_REASON_LENGTH + " characters.");
		}
		if (!this.can('ban', targetUser)) return false;

		if (Users.checkBanned(targetUser.latestIp) && !target && !targetUser.connected) {
			var problem = " but was already banned";
			return this.privateModCommand("(" + targetUser.name + " would be banned by " + user.name + problem + ".)");
		}

		targetUser.popup("" + user.name + " has banned you." + (Config.appealurl ? (" If you feel that your banning was unjustified you can appeal the ban:\n" + Config.appealurl) : "") + "\n\n" + target);

		this.addModCommand("" + targetUser.name + " was banned by " + user.name + "." + (target ? " (" + target + ")" : ""), " (" + targetUser.latestIp + ")");
		var alts = targetUser.getAlts();
		if (alts.length) {
			this.privateModCommand("(" + targetUser.name + "'s " + (targetUser.autoconfirmed ? " ac account: " + targetUser.autoconfirmed + ", " : "") + "banned alts: " + alts.join(", ") + ")");
			for (var i = 0; i < alts.length; ++i) {
				this.add('|unlink|' + toId(alts[i]));
			}
		} else if (targetUser.autoconfirmed) {
			this.privateModCommand("(" + targetUser.name + "'s ac account: " + targetUser.autoconfirmed + ")");
		}

		this.add('|unlink|' + this.getLastIdOf(targetUser));
		targetUser.ban();
	},

	ub:'unban',
	unban: function (target, room, user) {
		if (!target) return this.parse('/help unban');
		if (user.locked || user.mutedRooms[room.id]) return this.sendReply("You cannot do this while unable to talk.");
		if (!this.can('ban')) return false;

		var name = Users.unban(target);

		if (name) {
			this.addModCommand("" + name + " was unbanned by " + user.name + ".");
		} else {
			this.sendReply("User '" + target + "' is not banned.");
		}
	},

	unbanall: function (target, room, user) {
		if (!this.can('rangeban')) return false;
		if (user.locked || user.mutedRooms[room.id]) return this.sendReply("You cannot do this while unable to talk.");
		// we have to do this the hard way since it's no longer a global
		for (var i in Users.bannedIps) {
			delete Users.bannedIps[i];
		}
		for (var i in Users.lockedIps) {
			delete Users.lockedIps[i];
		}
		this.addModCommand("All bans and locks have been lifted by " + user.name + ".");
	},

	banip: function (target, room, user) {
		if (user.locked || user.mutedRooms[room.id]) return this.sendReply("You cannot do this while unable to talk.");
		target = target.trim();
		if (!target) {
			return this.parse('/help banip');
		}
		if (!this.can('rangeban')) return false;
		if (Users.bannedIps[target] === '#ipban') return this.sendReply("The IP " + (target.charAt(target.length - 1) === '*' ? "range " : "") + target + " has already been temporarily banned.");

		Users.bannedIps[target] = '#ipban';
		this.addModCommand("" + user.name + " temporarily banned the " + (target.charAt(target.length - 1) === '*' ? "IP range" : "IP") + ": " + target);
	},

	unbanip: function (target, room, user) {
		if (user.locked || user.mutedRooms[room.id]) return this.sendReply("You cannot do this while unable to talk.");
		target = target.trim();
		if (!target) {
			return this.parse('/help unbanip');
		}
		if (!this.can('rangeban')) return false;
		if (!Users.bannedIps[target]) {
			return this.sendReply("" + target + " is not a banned IP or IP range.");
		}
		delete Users.bannedIps[target];
		this.addModCommand("" + user.name + " unbanned the " + (target.charAt(target.length - 1) === '*' ? "IP range" : "IP") + ": " + target);
	},

	/*********************************************************
	 * Moderating: Other
	 *********************************************************/

	mn: 'modnote',
	modnote: function (target, room, user, connection) {
		if (!target) return this.parse('/help modnote');
		if (user.locked || user.mutedRooms[room.id]) return this.sendReply("You cannot do this while unable to talk.");

		if (target.length > MAX_REASON_LENGTH) {
			return this.sendReply("The note is too long. It cannot exceed " + MAX_REASON_LENGTH + " characters.");
		}
		if (!this.can('receiveauthmessages', null, room)) return false;
		return this.privateModCommand("(" + user.name + " notes: " + target + ")");
	},

	sca: 'customavatar',
	customavatar: function(target, room, user, connection) {
		if (!this.can('customavatars')) return false;
		if (!target) return connection.sendTo(room, 'Usage: /customavatar username, URL');
		var http = require('http-get');
		target = target.split(", ");
		var username = Users.get(target[0]);
       		var filename = target[1].split('.');
		filename = '.'+filename.pop();
		if (filename != ".png" && filename != ".gif") return connection.sendTo(room, '/customavatar - Invalid image type! Images are required to be png or gif.');
		if (!username) return this.sendReply('User '+target[0]+' not found.');
		if (filename == ".png") Users.get(username).canCustomAvatar = false;
		if (filename == ".gif") Users.get(username).canAnimatedAvatar = false;
     		filename = Users.get(username)+filename;
		http.get(target[1], 'config/avatars/' + filename, function (error, result) {
			if (error) {
    				return connection.sendTo(room, '/customavatar - You supplied an invalid URL!');
    			} else {
				avatar.write('\n'+username+','+filename);
				Users.get(username).avatar = filename;
				connection.sendTo(room, username+' has received a custom avatar.');
				Users.get(username).sendTo(room, 'You have received a custom avatar from ' + user.name + '.');
				for (var u in Users.users) {
					if (Users.users[u].group == "~" || Users.users[u].group == "&") {
						Users.users[u].send('|pm|~Server|'+Users.users[u].group+Users.users[u].name+'|'+username+' has received a custom avatar from '+user.name+'.');
					}
				}
				Rooms.rooms.staff.send(username+' has received a custom avatar from '+user.name+'.');
	    		}
		});
		this.logModCommand(user.name + ' added a custom avatar for ' + username + '.');
	},


	demote: 'promote',
	promo: 'promote',
	upgrade: 'promote',
	promote: function (target, room, user, connection, cmd) {
		if (!target) return this.parse('/help promote');

		target = this.splitTarget(target, true);
		var targetUser = this.targetUser;
		var userid = toId(this.targetUsername);
		var name = targetUser ? targetUser.name : this.targetUsername;

		if (!userid) return this.parse('/help promote');

		var currentGroup = ((targetUser && targetUser.group) || Users.usergroups[userid] || ' ')[0];
		var nextGroup = target ? target : Users.getNextGroupSymbol(currentGroup, cmd === 'demote', true);
		if (target === 'deauth') nextGroup = Config.groupsranking[0];
		if (!Config.groups[nextGroup]) {
			return this.sendReply("Group '" + nextGroup + "' does not exist.");
		}
		if (Config.groups[nextGroup].roomonly) {
			return this.sendReply("Group '" + nextGroup + "' does not exist as a global rank.");
		}

		var groupName = Config.groups[nextGroup].name || "regular user";
		if (currentGroup === nextGroup) {
			return this.sendReply("User '" + name + "' is already a " + groupName);
		}
		if (!user.canPromote(currentGroup, nextGroup)) {
			return this.sendReply("/" + cmd + " - Access denied.");
		}

		if (!Users.setOfflineGroup(name, nextGroup)) {
			return this.sendReply("/promote - WARNING: This user is offline and could be unregistered. Use /forcepromote if you're sure you want to risk it.");
		}
		if (Config.groups[nextGroup].rank < Config.groups[currentGroup].rank) {
			this.privateModCommand("(" + name + " was demoted to " + groupName + " by " + user.name + ".)");
			if (targetUser) targetUser.popup("You were demoted to " + groupName + " by " + user.name + ".");
		} else {
			this.addModCommand("" + name + " was promoted to " + groupName + " by " + user.name + ".");
		}

		if (targetUser) targetUser.updateIdentity();
	},

	forcepromote: function (target, room, user) {
		// warning: never document this command in /help
		if (!this.can('forcepromote')) return false;
		target = this.splitTarget(target, true);
		var name = this.targetUsername;
		var nextGroup = target || Users.getNextGroupSymbol(' ', false);

		if (!Users.setOfflineGroup(name, nextGroup, true)) {
			return this.sendReply("Nope");
		}

		this.addModCommand("" + name + " was promoted to " + (Config.groups[nextGroup].name || "regular user") + " by " + user.name + ".");
	},

	deauth: function (target, room, user) {
		return this.parse('/demote ' + target + ', deauth');
	},

	modchat: function (target, room, user) {
		if (!target) return this.sendReply("Moderated chat is currently set to: " + room.modchat);
		if (user.locked || user.mutedRooms[room.id]) return this.sendReply("You cannot do this while unable to talk.");
		if (!this.can('modchat', null, room)) return false;

		if (room.modchat && room.modchat.length <= 1 && Config.groupsranking.indexOf(room.modchat) > 1 && !user.can('modchatall', null, room)) {
			return this.sendReply("/modchat - Access denied for removing a setting higher than " + Config.groupsranking[1] + ".");
		}

		target = target.toLowerCase();
		var currentModchat = room.modchat;
		switch (target) {
		case 'off':
		case 'false':
		case 'no':
		case ' ':
			room.modchat = false;
			break;
		case 'ac':
		case 'autoconfirmed':
			room.modchat = 'autoconfirmed';
			break;
		case '*':
		case 'player':
			target = '\u2605';
			/* falls through */
		default:
			if (!Config.groups[target]) {
				return this.parse('/help modchat');
			}
			if (Config.groupsranking.indexOf(target) > 1 && !user.can('modchatall', null, room)) {
				return this.sendReply("/modchat - Access denied for setting higher than " + Config.groupsranking[1] + ".");
			}
			room.modchat = target;
			break;
		}
		if (currentModchat === room.modchat) {
			return this.sendReply("Modchat is already set to " + currentModchat + ".");
		}
		if (!room.modchat) {
			this.add("|raw|<div class=\"broadcast-blue\"><b>Moderated chat was disabled!</b><br />Anyone may talk now.</div>");
		} else {
			var modchat = Tools.escapeHTML(room.modchat);
			this.add("|raw|<div class=\"broadcast-red\"><b>Moderated chat was set to " + modchat + "!</b><br />Only users of rank " + modchat + " and higher can talk.</div>");
		}
		this.logModCommand(user.name + " set modchat to " + room.modchat);

		if (room.chatRoomData) {
			room.chatRoomData.modchat = room.modchat;
			Rooms.global.writeChatRoomData();
		}
	},

	declare: function (target, room, user) {
		if (!target) return this.parse('/help declare');
		if (!this.can('declare', null, room)) return false;

		if (!this.canTalk()) return;

		this.add('|raw|<div class="broadcast-blue"><b>' + Tools.escapeHTML(target) + '</b></div>');
		this.logModCommand(user.name + " declared " + target);
	},

	htmldeclare: function (target, room, user) {
		if (!target) return this.parse('/help htmldeclare');
		if (!this.can('gdeclare', null, room)) return false;

		if (!this.canTalk()) return;

		this.add('|raw|<div class="broadcast-blue"><b>' + target + '</b></div>');
		this.logModCommand(user.name + " declared " + target);
	},

	gdeclare: 'globaldeclare',
	globaldeclare: function (target, room, user) {
		if (!target) return this.parse('/help globaldeclare');
		if (!this.can('gdeclare')) return false;

		for (var id in Rooms.rooms) {
			if (id !== 'global') Rooms.rooms[id].addRaw('<div class="broadcast-blue"><b>' + target + '</b></div>');
		}
		this.logModCommand(user.name + " globally declared " + target);
	},

	cdeclare: 'chatdeclare',
	chatdeclare: function (target, room, user) {
		if (!target) return this.parse('/help chatdeclare');
		if (!this.can('gdeclare')) return false;

		for (var id in Rooms.rooms) {
			if (id !== 'global') if (Rooms.rooms[id].type !== 'battle') Rooms.rooms[id].addRaw('<div class="broadcast-blue"><b>' + target + '</b></div>');
		}
		this.logModCommand(user.name + " globally declared (chat level) " + target);
	},

	wall: 'announce',
	announce: function (target, room, user) {
		if (!target) return this.parse('/help announce');

		if (!this.can('announce', null, room)) return false;

		target = this.canTalk(target);
		if (!target) return;

		return '/announce ' + target;
	},

	dename: 'forcerename',
	fr: 'forcerename',
	forcerename: function (target, room, user) {
		if (!target) return this.parse('/help forcerename');
		if (user.locked || user.mutedRooms[room.id]) return this.sendReply("You cannot do this while unable to talk.");
		var commaIndex = target.indexOf(',');
		var targetUser, reason;
		if (commaIndex !== -1) {
			reason = target.substr(commaIndex + 1).trim();
			target = target.substr(0, commaIndex);
		}
		targetUser = Users.get(target);
		if (!targetUser) return this.sendReply("User '" + this.targetUsername + "' not found.");
		if (!this.can('forcerename', targetUser)) return false;

		if (targetUser.userid !== toId(target)) {
			return this.sendReply("User '" + target + "' had already changed its name to '" + targetUser.name + "'.");
		}

		var entry = targetUser.name + " was forced to choose a new name by " + user.name + (reason ? ": " + reason: "");
		this.privateModCommand("(" + entry + ")");
		Rooms.global.cancelSearch(targetUser);
		targetUser.resetName();
		targetUser.send("|nametaken||" + user.name + " has forced you to change your name. " + target);
	},

	modlog: function (target, room, user, connection) {
		var lines = 0;
		// Specific case for modlog command. Room can be indicated with a comma, lines go after the comma.
		// Otherwise, the text is defaulted to text search in current room's modlog.
		var roomId = room.id;
		var hideIps = !user.can('ban');

		if (target.indexOf(',') > -1) {
			var targets = target.split(',');
			target = targets[1].trim();
			roomId = toId(targets[0]) || room.id;
		}

		// Let's check the number of lines to retrieve or if it's a word instead
		if (!target.match('[^0-9]')) {
			lines = parseInt(target || 15, 10);
			if (lines > 100) lines = 100;
		}
		var wordSearch = (!lines || lines < 0);

		// Control if we really, really want to check all modlogs for a word.
		var roomNames = '';
		var filename = '';
		var command = '';
		if (roomId === 'all' && wordSearch) {
			if (!this.can('modlog')) return;
			roomNames = 'all rooms';
			// Get a list of all the rooms
			var fileList = fs.readdirSync('logs/modlog');
			for (var i = 0; i < fileList.length; ++i) {
				filename += 'logs/modlog/' + fileList[i] + ' ';
			}
		} else {
			if (!this.can('modlog', null, Rooms.get(roomId))) return;
			roomNames = 'the room ' + roomId;
			filename = 'logs/modlog/modlog_' + roomId + '.txt';
		}

		// Seek for all input rooms for the lines or text
		command = 'tail -' + lines + ' ' + filename;
		var grepLimit = 100;
		if (wordSearch) { // searching for a word instead
			if (target.match(/^["'].+["']$/)) target = target.substring(1, target.length - 1);
			command = "awk '{print NR,$0}' " + filename + " | sort -nr | cut -d' ' -f2- | grep -m" + grepLimit + " -i '" + target.replace(/\\/g, '\\\\\\\\').replace(/["'`]/g, '\'\\$&\'').replace(/[\{\}\[\]\(\)\$\^\.\?\+\-\*]/g, '[$&]') + "'";
		}

		// Execute the file search to see modlog
		require('child_process').exec(command, function (error, stdout, stderr) {
			if (error && stderr) {
				connection.popup("/modlog empty on " + roomNames + " or erred - modlog does not support Windows");
				console.log("/modlog error: " + error);
				return false;
			}
			if (stdout && hideIps) {
				stdout = stdout.replace(/\([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+\)/g, '');
			}
			if (lines) {
				if (!stdout) {
					connection.popup("The modlog is empty. (Weird.)");
				} else {
					connection.popup("Displaying the last " + lines + " lines of the Moderator Log of " + roomNames + ":\n\n" + stdout);
				}
			} else {
				if (!stdout) {
					connection.popup("No moderator actions containing '" + target + "' were found on " + roomNames + ".");
				} else {
					connection.popup("Displaying the last " + grepLimit + " logged actions containing '" + target + "' on " + roomNames + ":\n\n" + stdout);
				}
			}
		});
	},

	servers: function (target, room, user) {
		if (!this.canBroadcast()) return;
		 this.popupReply('<center><b>BAM</b>: They\'re creating a <a href="http://bam.psim.us/">New Metagame</a> with new pokemon, abilities, moves, and items.</center><br />'+
		 	'<center><b>Aqua</b>: <a href="http://aqua.psim.us/"></a></center><br />'+
		 	'<center><b>Luminous</b>: <a href="http://luminous.psim.us/"></a></center><br />'+
		 	'<center><b>Pixie World</b>: <a href="http://pixieworld.psim.us/"></a> </center><br />'+
		 	'<center><b>Pokecommunity</b>: <a href="http://pokecommunity.psim.us/"></a> </center><br />'+
		 	'<center><b>Flora</b>: <a href="http://flora.psim.us/"></a></center><br />'+
		 	'<center><b>Cosy Cabin</b>: <a href="http://cosycabin.psim.us/"></a> </center><br />'+
		 	'<center><b>Pokelunar</b>: <a href="http://pokelunar.psim.us/"></a> </center><br />'+
		 	'<center><b>Oblivion</b>: <a href="http://oblivion.psim.us/"></a> </center><br />'+
		 	'<center><b>KillTheNoise</b>: <a href="http://killthenoise.psim.us/">New Metagame</a></center><br />');
	},

	/*********************************************************
	 * Server management commands
	 *********************************************************/

	hotpatch: function (target, room, user) {
		if (!target) return this.parse('/help hotpatch');
		if (!this.can('hotpatch')) return false;

		this.logEntry(user.name + " used /hotpatch " + target);

		if (target === 'chat' || target === 'commands') {

			try {
				CommandParser.uncacheTree('./command-parser.js');
				global.CommandParser = require('./command-parser.js');

				var runningTournaments = Tournaments.tournaments;
				CommandParser.uncacheTree('./tournaments');
				global.Tournaments = require('./tournaments');
				Tournaments.tournaments = runningTournaments;

				return this.sendReply("Chat commands have been hot-patched.");
			} catch (e) {
				return this.sendReply("Something failed while trying to hotpatch chat: \n" + e.stack);
			}

		} else if (target === 'tournaments') {

			try {
				var runningTournaments = Tournaments.tournaments;
				CommandParser.uncacheTree('./tournaments');
				global.Tournaments = require('./tournaments');
				Tournaments.tournaments = runningTournaments;
				return this.sendReply("Tournaments have been hot-patched.");
			} catch (e) {
				return this.sendReply("Something failed while trying to hotpatch tournaments: \n" + e.stack);
			}

		} else if (target === 'battles') {

			/*Simulator.SimulatorProcess.respawn();
			return this.sendReply("Battles have been hotpatched. Any battles started after now will use the new code; however, in-progress battles will continue to use the old code.");*/
			return this.sendReply("Battle hotpatching is not supported with the single process hack.");

		} else if (target === 'formats') {
			/*try {
				// uncache the tools.js dependency tree
				CommandParser.uncacheTree('./tools.js');
				// reload tools.js
				global.Tools = require('./tools.js'); // note: this will lock up the server for a few seconds
				// rebuild the formats list
				Rooms.global.formatListText = Rooms.global.getFormatListText();
				// respawn validator processes
				TeamValidator.ValidatorProcess.respawn();
				// respawn simulator processes
				Simulator.SimulatorProcess.respawn();
				// broadcast the new formats list to clients
				Rooms.global.send(Rooms.global.formatListText);

				return this.sendReply("Formats have been hotpatched.");
			} catch (e) {
				return this.sendReply("Something failed while trying to hotpatch formats: \n" + e.stack);
			}*/
			return this.sendReply("Formats hotpatching is not supported with the single process hack.");

		} else if (target === 'learnsets') {
			try {
				// uncache the tools.js dependency tree
				CommandParser.uncacheTree('./tools.js');
				// reload tools.js
				global.Tools = require('./tools.js'); // note: this will lock up the server for a few seconds

				return this.sendReply("Learnsets have been hotpatched.");
			} catch (e) {
				return this.sendReply("Something failed while trying to hotpatch learnsets: \n" + e.stack);
			}

		}
		this.sendReply("Your hot-patch command was unrecognized.");
	},

	savelearnsets: function (target, room, user) {
		if (!this.can('hotpatch')) return false;
		fs.writeFile('data/learnsets.js', 'exports.BattleLearnsets = ' + JSON.stringify(Tools.data.Learnsets) + ";\n");
		this.sendReply("learnsets.js saved.");
	},

	disableladder: function (target, room, user) {
		if (!this.can('disableladder')) return false;
		if (LoginServer.disabled) {
			return this.sendReply("/disableladder - Ladder is already disabled.");
		}
		LoginServer.disabled = true;
		this.logModCommand("The ladder was disabled by " + user.name + ".");
		this.add("|raw|<div class=\"broadcast-red\"><b>Due to high server load, the ladder has been temporarily disabled</b><br />Rated games will no longer update the ladder. It will be back momentarily.</div>");
	},

	enableladder: function (target, room, user) {
		if (!this.can('disableladder')) return false;
		if (!LoginServer.disabled) {
			return this.sendReply("/enable - Ladder is already enabled.");
		}
		LoginServer.disabled = false;
		this.logModCommand("The ladder was enabled by " + user.name + ".");
		this.add("|raw|<div class=\"broadcast-green\"><b>The ladder is now back.</b><br />Rated games will update the ladder now.</div>");
	},

	lockdown: function (target, room, user) {
		if (!this.can('lockdown')) return false;

		Rooms.global.lockdown = true;
		for (var id in Rooms.rooms) {
			if (id === 'global') continue;
			var curRoom = Rooms.rooms[id];
			curRoom.addRaw("<div class=\"broadcast-red\"><b>The server is restarting soon.</b><br />Please finish your battles quickly. No new battles can be started until the server resets in a few minutes.</div>");
			if (curRoom.requestKickInactive && !curRoom.battle.ended) {
				curRoom.requestKickInactive(user, true);
				if (curRoom.modchat !== '+') {
					curRoom.modchat = '+';
					curRoom.addRaw("<div class=\"broadcast-red\"><b>Moderated chat was set to +!</b><br />Only users of rank + and higher can talk.</div>");
				}
			}
		}

		this.logEntry(user.name + " used /lockdown");
	},

	slowlockdown: function (target, room, user) {
		if (!this.can('lockdown')) return false;

		Rooms.global.lockdown = true;
		for (var id in Rooms.rooms) {
			if (id === 'global') continue;
			var curRoom = Rooms.rooms[id];
			if (curRoom.battle) continue;
			curRoom.addRaw("<div class=\"broadcast-red\"><b>The server is restarting soon.</b><br />Please finish your battles quickly. No new battles can be started until the server resets in a few minutes.</div>");
		}

		this.logEntry(user.name + " used /slowlockdown");
	},

	endlockdown: function (target, room, user) {
		if (!this.can('lockdown')) return false;

		if (!Rooms.global.lockdown) {
			return this.sendReply("We're not under lockdown right now.");
		}
		Rooms.global.lockdown = false;
		for (var id in Rooms.rooms) {
			if (id !== 'global') Rooms.rooms[id].addRaw("<div class=\"broadcast-green\"><b>The server shutdown was canceled.</b></div>");
		}

		this.logEntry(user.name + " used /endlockdown");
	},

	emergency: function (target, room, user) {
		if (!this.can('lockdown')) return false;

		if (Config.emergency) {
			return this.sendReply("We're already in emergency mode.");
		}
		Config.emergency = true;
		for (var id in Rooms.rooms) {
			if (id !== 'global') Rooms.rooms[id].addRaw("<div class=\"broadcast-red\">The server has entered emergency mode. Some features might be disabled or limited.</div>");
		}

		this.logEntry(user.name + " used /emergency");
	},

	endemergency: function (target, room, user) {
		if (!this.can('lockdown')) return false;

		if (!Config.emergency) {
			return this.sendReply("We're not in emergency mode.");
		}
		Config.emergency = false;
		for (var id in Rooms.rooms) {
			if (id !== 'global') Rooms.rooms[id].addRaw("<div class=\"broadcast-green\"><b>The server is no longer in emergency mode.</b></div>");
		}

		this.logEntry(user.name + " used /endemergency");
	},

	kill: function (target, room, user) {
		if (!this.can('lockdown')) return false;

		if (!Rooms.global.lockdown) {
			return this.sendReply("For safety reasons, /kill can only be used during lockdown.");
		}

		if (CommandParser.updateServerLock) {
			return this.sendReply("Wait for /updateserver to finish before using /kill.");
		}

		/*for (var i in Sockets.workers) {
			Sockets.workers[i].kill();
		}*/

		if (!room.destroyLog) {
			process.exit();
			return;
		}
		room.destroyLog(function () {
			room.logEntry(user.name + " used /kill");
		}, function () {
			process.exit();
		});

		// Just in the case the above never terminates, kill the process
		// after 10 seconds.
		setTimeout(function () {
			process.exit();
		}, 10000);
	},

	lbl: 'loadbanlist',
	loadbanlist: function (target, room, user, connection) {
		if (!this.can('hotpatch')) return false;

		connection.sendTo(room, "Loading ipbans.txt...");
		fs.readFile('config/ipbans.txt', function (err, data) {
			if (err) return;
			data = ('' + data).split('\n');
			var rangebans = [];
			for (var i = 0; i < data.length; ++i) {
				var line = data[i].split('#')[0].trim();
				if (!line) continue;
				if (line.indexOf('/') >= 0) {
					rangebans.push(line);
				} else if (line && !Users.bannedIps[line]) {
					Users.bannedIps[line] = '#ipban';
				}
			}
			Users.checkRangeBanned = Cidr.checker(rangebans);
			connection.sendTo(room, "ipbans.txt has been reloaded.");
		});
	},

	refreshpage: function (target, room, user) {
		if (!this.can('hotpatch')) return false;
		Rooms.global.send('|refresh|');
		this.logEntry(user.name + " used /refreshpage");
	},

	updateserver: function (target, room, user, connection) {
		if (!user.hasConsoleAccess(connection)) {
			return this.sendReply("/updateserver - Access denied.");
		}

		if (CommandParser.updateServerLock) {
			return this.sendReply("/updateserver - Another update is already in progress.");
		}

		CommandParser.updateServerLock = true;

		var logQueue = [];
		logQueue.push(user.name + " used /updateserver");

		connection.sendTo(room, "updating...");

		var exec = require('child_process').exec;
		exec('git diff-index --quiet HEAD --', function (error) {
			var cmd = 'git pull --rebase';
			if (error) {
				if (error.code === 1) {
					// The working directory or index have local changes.
					cmd = 'git stash && ' + cmd + ' && git stash pop';
				} else {
					// The most likely case here is that the user does not have
					// `git` on the PATH (which would be error.code === 127).
					connection.sendTo(room, "" + error);
					logQueue.push("" + error);
					logQueue.forEach(function (line) {
						room.logEntry(line);
					});
					CommandParser.updateServerLock = false;
					return;
				}
			}
			var entry = "Running `" + cmd + "`";
			connection.sendTo(room, entry);
			logQueue.push(entry);
			exec(cmd, function (error, stdout, stderr) {
				("" + stdout + stderr).split("\n").forEach(function (s) {
					connection.sendTo(room, s);
					logQueue.push(s);
				});
				logQueue.forEach(function (line) {
					room.logEntry(line);
				});
				CommandParser.updateServerLock = false;
			});
		});
	},


	fixed:'crashfixed',
	crashfixed: function (target, room, user) {
		if (!Rooms.global.lockdown) {
			return this.sendReply('/crashfixed - There is no active crash.');
		}
		if (!this.can('hotpatch')) return false;

		Rooms.global.lockdown = false;
		if (Rooms.lobby) {
			Rooms.lobby.modchat = false;
			Rooms.lobby.addRaw("<div class=\"broadcast-green\"><b>We fixed the crash without restarting the server!</b><br />You may resume talking in the lobby and starting new battles.</div>");
		}
		this.logEntry(user.name + " used /crashfixed");
	},

	bw: 'banword',
	banword: function(target, room, user) {
		if (!this.can('declare')) return false;
			target = toId(target);
		if (!target) {
			return this.sendReply('Specify a word or phrase to ban.');
	}
		Users.addBannedWord(target);
		this.sendReply('Added \"'+target+'\" to the list of banned words.');
	},

	ubw: 'unbanword',
	unbanword: function(target, room, user) {
		if (!this.can('declare')) return false;
			target = toId(target);
		if (!target) {
			return this.sendReply('Specify a word or phrase to unban.');
	}
		Users.removeBannedWord(target);
		this.sendReply('Removed \"'+target+'\" from the list of banned words.');
	},

	'memusage': 'memoryusage',
	memoryusage: function (target) {
		if (!this.can('hotpatch')) return false;
		target = toId(target) || 'all';
		if (target === 'all') {
			this.sendReply("Loading memory usage, this might take a while.");
		}
		var roomSize, configSize, rmSize, cpSize, simSize, usersSize, toolsSize;
		if (target === 'all' || target === 'rooms' || target === 'room') {
			this.sendReply("Calculating Room size...");
			roomSize = ResourceMonitor.sizeOfObject(Rooms);
			this.sendReply("Rooms are using " + roomSize + " bytes of memory.");
		}
		if (target === 'all' || target === 'config') {
			this.sendReply("Calculating config size...");
			configSize = ResourceMonitor.sizeOfObject(Config);
			this.sendReply("Config is using " + configSize + " bytes of memory.");
		}
		if (target === 'all' || target === 'resourcemonitor' || target === 'rm') {
			this.sendReply("Calculating Resource Monitor size...");
			rmSize = ResourceMonitor.sizeOfObject(ResourceMonitor);
			this.sendReply("The Resource Monitor is using " + rmSize + " bytes of memory.");
		}
		if (target === 'all' || target === 'cmdp' || target === 'cp' || target === 'commandparser') {
			this.sendReply("Calculating Command Parser size...");
			cpSize = ResourceMonitor.sizeOfObject(CommandParser);
			this.sendReply("Command Parser is using " + cpSize + " bytes of memory.");
		}
		if (target === 'all' || target === 'sim' || target === 'simulator') {
			this.sendReply("Calculating Simulator size...");
			simSize = ResourceMonitor.sizeOfObject(Simulator);
			this.sendReply("Simulator is using " + simSize + " bytes of memory.");
		}
		if (target === 'all' || target === 'users') {
			this.sendReply("Calculating Users size...");
			usersSize = ResourceMonitor.sizeOfObject(Users);
			this.sendReply("Users is using " + usersSize + " bytes of memory.");
		}
		if (target === 'all' || target === 'tools') {
			this.sendReply("Calculating Tools size...");
			toolsSize = ResourceMonitor.sizeOfObject(Tools);
			this.sendReply("Tools are using " + toolsSize + " bytes of memory.");
		}
		if (target === 'all' || target === 'v8') {
			this.sendReply("Retrieving V8 memory usage...");
			var o = process.memoryUsage();
			this.sendReply(
				"Resident set size: " + o.rss + ", " + o.heapUsed + " heap used of " + o.heapTotal  + " total heap. " +
				 (o.heapTotal - o.heapUsed) + " heap left."
			);
		}
		if (target === 'all') {
			this.sendReply("Calculating Total size...");
			var total = (roomSize + configSize + rmSize + cpSize + simSize + usersSize + toolsSize) || 0;
			var units = ["bytes", "K", "M", "G"];
			var converted = total;
			var unit = 0;
			while (converted > 1024) {
				converted /= 1024;
				++unit;
			}
			converted = Math.round(converted);
			this.sendReply("Total memory used: " + converted + units[unit] + " (" + total + " bytes).");
		}
		return;
	},

	bash: function (target, room, user, connection) {
		if (!user.hasConsoleAccess(connection)) {
			return this.sendReply("/bash - Access denied.");
		}

		var exec = require('child_process').exec;
		exec(target, function (error, stdout, stderr) {
			connection.sendTo(room, ("" + stdout + stderr));
		});
	},

	eval: function (target, room, user, connection) {
		if (!user.hasConsoleAccess(connection)) {
			return this.sendReply("/eval - Access denied.");
		}
		if (!this.canBroadcast()) return;

		if (!this.broadcasting) this.sendReply('||>> ' + target);
		try {
			var battle = room.battle;
			var me = user;
			this.sendReply('||<< ' + eval(target));
		} catch (e) {
			this.sendReply('||<< error: ' + e.message);
			var stack = '||' + ('' + e.stack).replace(/\n/g, '\n||');
			connection.sendTo(room, stack);
		}
	},

	evalbattle: function (target, room, user, connection) {
		if (!user.hasConsoleAccess(connection)) {
			return this.sendReply("/evalbattle - Access denied.");
		}
		if (!this.canBroadcast()) return;
		if (!room.battle) {
			return this.sendReply("/evalbattle - This isn't a battle room.");
		}

		room.battle.send('eval', target.replace(/\n/g, '\f'));
	},

	/*********************************************************
	 * Battle commands
	 *********************************************************/

	forfeit: function (target, room, user) {
		if (!room.battle) {
			return this.sendReply("There's nothing to forfeit here.");
		}
		if (!room.forfeit(user)) {
			return this.sendReply("You can't forfeit this battle.");
		}
	},

	savereplay: function (target, room, user, connection) {
		if (!room || !room.battle) return;
		var logidx = 2; // spectator log (no exact HP)
		if (room.battle.ended) {
			// If the battle is finished when /savereplay is used, include
			// exact HP in the replay log.
			logidx = 3;
		}
		var data = room.getLog(logidx).join("\n");
		var datahash = crypto.createHash('md5').update(data.replace(/[^(\x20-\x7F)]+/g, '')).digest('hex');

		LoginServer.request('prepreplay', {
			id: room.id.substr(7),
			loghash: datahash,
			p1: room.p1.name,
			p2: room.p2.name,
			format: room.format
		}, function (success) {
			if (success && success.errorip) {
				connection.popup("This server's request IP " + success.errorip + " is not a registered server.");
				return;
			}
			connection.send('|queryresponse|savereplay|' + JSON.stringify({
				log: data,
				id: room.id.substr(7)
			}));
		});
	},

	mv: 'move',
	attack: 'move',
	move: function (target, room, user) {
		if (!room.decision) return this.sendReply("You can only do this in battle rooms.");

		room.decision(user, 'choose', 'move ' + target);
	},

	sw: 'switch',
	switch: function (target, room, user) {
		if (!room.decision) return this.sendReply("You can only do this in battle rooms.");

		room.decision(user, 'choose', 'switch ' + parseInt(target, 10));
	},

	choose: function (target, room, user) {
		if (!room.decision) return this.sendReply("You can only do this in battle rooms.");

		room.decision(user, 'choose', target);
	},

	undo: function (target, room, user) {
		if (!room.decision) return this.sendReply("You can only do this in battle rooms.");

		room.decision(user, 'undo', target);
	},

	team: function (target, room, user) {
		if (!room.decision) return this.sendReply("You can only do this in battle rooms.");

		room.decision(user, 'choose', 'team ' + target);
	},

	joinbattle: function (target, room, user) {
		if (!room.joinBattle) return this.sendReply("You can only do this in battle rooms.");
		if (!user.can('joinbattle', null, room)) return this.popupReply("You must be a roomvoice to join a battle you didn't start. Ask a player to use /roomvoice on you to join this battle.");

		room.joinBattle(user);
	},

	partbattle: 'leavebattle',
	leavebattle: function (target, room, user) {
		if (!room.leaveBattle) return this.sendReply("You can only do this in battle rooms.");

		room.leaveBattle(user);
	},

	kickbattle: function (target, room, user) {
		if (!room.leaveBattle) return this.sendReply("You can only do this in battle rooms.");

		target = this.splitTarget(target);
		var targetUser = this.targetUser;
		if (!targetUser || !targetUser.connected) {
			return this.sendReply("User " + this.targetUsername + " not found.");
		}
		if (!this.can('kick', targetUser)) return false;

		if (room.leaveBattle(targetUser)) {
			this.addModCommand("" + targetUser.name + " was kicked from a battle by " + user.name + (target ? " (" + target + ")" : ""));
		} else {
			this.sendReply("/kickbattle - User isn't in battle.");
		}
	},

	kickinactive: function (target, room, user) {
		if (room.requestKickInactive) {
			room.requestKickInactive(user);
		} else {
			this.sendReply("You can only kick inactive players from inside a room.");
		}
	},

	timer: function (target, room, user) {
		target = toId(target);
		if (room.requestKickInactive) {
			if (target === 'off' || target === 'false' || target === 'stop') {
				room.stopKickInactive(user, user.can('timer'));
			} else if (target === 'on' || target === 'true' || !target) {
				room.requestKickInactive(user, user.can('timer'));
			} else {
				this.sendReply("'" + target + "' is not a recognized timer state.");
			}
		} else {
			this.sendReply("You can only set the timer from inside a room.");
		}
	},

	autotimer: 'forcetimer',
	forcetimer: function (target, room, user) {
		target = toId(target);
		if (!this.can('autotimer')) return;
		if (target === 'off' || target === 'false' || target === 'stop') {
			Config.forcetimer = false;
			this.addModCommand("Forcetimer is now OFF: The timer is now opt-in. (set by " + user.name + ")");
		} else if (target === 'on' || target === 'true' || !target) {
			Config.forcetimer = true;
			this.addModCommand("Forcetimer is now ON: All battles will be timed. (set by " + user.name + ")");
		} else {
			this.sendReply("'" + target + "' is not a recognized forcetimer setting.");
		}
	},

	forcetie: 'forcewin',
	forcewin: function (target, room, user) {
		if (!this.can('forcewin')) return false;
		if (!room.battle) {
			this.sendReply("/forcewin - This is not a battle room.");
			return false;
		}

		room.battle.endType = 'forced';
		if (!target) {
			room.battle.tie();
			this.logModCommand(user.name + " forced a tie.");
			return false;
		}
		target = Users.get(target);
		if (target) target = target.userid;
		else target = '';

		if (target) {
			room.battle.win(target);
			this.logModCommand(user.name + " forced a win for " + target + ".");
		}

	},

	/*********************************************************
	 * Challenging and searching commands
	 *********************************************************/

	cancelsearch: 'search',
	search: function (target, room, user) {
		if (target) {
			if (Config.pmmodchat) {
				var userGroup = user.group;
				if (Config.groupsranking.indexOf(userGroup) < Config.groupsranking.indexOf(Config.pmmodchat)) {
					var groupName = Config.groups[Config.pmmodchat].name || Config.pmmodchat;
					this.popupReply("Because moderated chat is set, you must be of rank " + groupName + " or higher to search for a battle.");
					return false;
				}
			}
			Rooms.global.searchBattle(user, target);
		} else {
			Rooms.global.cancelSearch(user);
		}
	},

	chall: 'challenge',
	challenge: function (target, room, user, connection) {
		target = this.splitTarget(target);
		var targetUser = this.targetUser;
		if (!targetUser || !targetUser.connected) {
			return this.popupReply("The user '" + this.targetUsername + "' was not found.");
		}
		if (targetUser.blockChallenges && !user.can('bypassblocks', targetUser)) {
			return this.popupReply("The user '" + this.targetUsername + "' is not accepting challenges right now.");
		}
		if (Config.pmmodchat) {
			var userGroup = user.group;
			if (Config.groupsranking.indexOf(userGroup) < Config.groupsranking.indexOf(Config.pmmodchat)) {
				var groupName = Config.groups[Config.pmmodchat].name || Config.pmmodchat;
				this.popupReply("Because moderated chat is set, you must be of rank " + groupName + " or higher to challenge users.");
				return false;
			}
		}
		user.prepBattle(target, 'challenge', connection, function (result) {
			if (result) user.makeChallenge(targetUser, target);
		});
	},

	idle: 'blockchallenges',
	blockchallenges: function (target, room, user) {
		user.blockChallenges = true;
		this.sendReply("You are now blocking all incoming challenge requests.");
	},

	allowchallenges: function (target, room, user) {
		user.blockChallenges = false;
		this.sendReply("You are available for challenges from now on.");
	},

	cchall: 'cancelChallenge',
	cancelchallenge: function (target, room, user) {
		user.cancelChallengeTo(target);
	},

	accept: function (target, room, user, connection) {
		var userid = toId(target);
		var format = '';
		if (user.challengesFrom[userid]) format = user.challengesFrom[userid].format;
		if (!format) {
			this.popupReply(target + " cancelled their challenge before you could accept it.");
			return false;
		}
		user.prepBattle(format, 'challenge', connection, function (result) {
			if (result) user.acceptChallengeFrom(userid);
		});
	},

	reject: function (target, room, user) {
		user.rejectChallengeFrom(toId(target));
	},

	saveteam: 'useteam',
	utm: 'useteam',
	useteam: function (target, room, user) {
		user.team = target;
	},

	/*********************************************************
	 * Low-level
	 *********************************************************/

	cmd: 'query',
	query: function (target, room, user, connection) {
		// Avoid guest users to use the cmd errors to ease the app-layer attacks in emergency mode
		var trustable = (!Config.emergency || (user.named && user.authenticated));
		if (Config.emergency && ResourceMonitor.countCmd(connection.ip, user.name)) return false;
		var spaceIndex = target.indexOf(' ');
		var cmd = target;
		if (spaceIndex > 0) {
			cmd = target.substr(0, spaceIndex);
			target = target.substr(spaceIndex + 1);
		} else {
			target = '';
		}
		if (cmd === 'userdetails') {

			var targetUser = Users.get(target);
			if (!trustable || !targetUser) {
				connection.send('|queryresponse|userdetails|' + JSON.stringify({
					userid: toId(target),
					rooms: false
				}));
				return false;
			}
			var roomList = {};
			for (var i in targetUser.roomCount) {
				if (i === 'global') continue;
				var targetRoom = Rooms.get(i);
				if (!targetRoom || targetRoom.isPrivate) continue;
				var roomData = {};
				if (targetRoom.battle) {
					var battle = targetRoom.battle;
					roomData.p1 = battle.p1 ? ' ' + battle.p1 : '';
					roomData.p2 = battle.p2 ? ' ' + battle.p2 : '';
				}
				roomList[i] = roomData;
			}
			if (!targetUser.roomCount['global']) roomList = false;
			var userdetails = {
				userid: targetUser.userid,
				avatar: targetUser.avatar,
				rooms: roomList
			};
			if (user.can('ip', targetUser)) {
				var ips = Object.keys(targetUser.ips);
				if (ips.length === 1) {
					userdetails.ip = ips[0];
				} else {
					userdetails.ips = ips;
				}
			}
			connection.send('|queryresponse|userdetails|' + JSON.stringify(userdetails));

		} else if (cmd === 'roomlist') {
			if (!trustable) return false;
			connection.send('|queryresponse|roomlist|' + JSON.stringify({
				rooms: Rooms.global.getRoomList(target)
			}));

		} else if (cmd === 'rooms') {
			if (!trustable) return false;
			connection.send('|queryresponse|rooms|' + JSON.stringify(
				Rooms.global.getRooms()
			));

		}
	},

	trn: function (target, room, user, connection) {
		var commaIndex = target.indexOf(',');
		var targetName = target;
		var targetAuth = false;
		var targetToken = '';
		if (commaIndex >= 0) {
			targetName = target.substr(0, commaIndex);
			target = target.substr(commaIndex + 1);
			commaIndex = target.indexOf(',');
			targetAuth = target;
			if (commaIndex >= 0) {
				targetAuth = !!parseInt(target.substr(0, commaIndex), 10);
				targetToken = target.substr(commaIndex + 1);
			}
		}
		user.rename(targetName, targetToken, targetAuth, connection);
	},
		

    away: 'away',
            away: function(target, room, user, connection) {
                    if (!this.can('broadcast')) return false;
     
                    if (!user.isAway) {
                            var originalName = user.name;
                            var awayName = user.name + ' - Away';
                            //delete the user object with the new name in case it exists - if it does it can cause issues with forceRename
                            delete Users.get(awayName);
                            user.forceRename(awayName, undefined, true);
     
                            this.add('|raw|-- <b><font color="#4F86F7">' + originalName +'</font color></b> is now away. '+ (target ? " (" + target + ")" : ""));
     
                            user.isAway = true;
                    }
                    else {
                            return this.sendReply('You are already set as away, type /back if you are now back');
                    }
     
                    user.updateIdentity();
            },

            coding: function(target, room, user, connection) {
                    if (!this.can('broadcast')) return false;
     
                    if (!user.isCoding) {
                            var originalName = user.name;
                            var codingname = user.name + ' - coding';
                            //delete the user object with the new name in case it exists - if it does it can cause issues with forceRename
                            delete Users.get(codingname);
                            user.forceRename(codingname, undefined, true);
     
                            this.add('|raw|-- <b><font color="#4F86F7">' + originalName +'</font color></b> is now coding. '+ (target ? " (" + target + ")" : ""));
     
                            user.isCoding = true;
                    }
                    else {
                            return this.sendReply('You are already set as away, type /back if you are now back');
                    }
     
                    user.updateIdentity();
            },
     
            back: function(target, room, user, connection) {
                    if (!this.can('broadcast')) return false;
     
                    if (user.isAway) {
     
                            var name = user.name;
     
                            var newName = name.substr(0, name.length - 7);
     
                            //delete the user object with the new name in case it exists - if it does it can cause issues with forceRename
                            delete Users.get(newName);
     
                            user.forceRename(newName, undefined, true);
     
                            //user will be authenticated
                            user.authenticated = true;
     
                            this.add('|raw|-- <b><font color="#4F86F7">' + newName + '</font color></b> is no longer away');
     
                            user.isAway = false;
                    }
                    else if (user.isCoding) {
     
                            var name = user.name;
     
                            var newName = name.substr(0, name.length - 7);
     
                            //delete the user object with the new name in case it exists - if it does it can cause issues with forceRename
                            delete Users.get(newName);
     
                            user.forceRename(newName, undefined, true);
     
                            //user will be authenticated
                            user.authenticated = true;
     
                            this.add('|raw|-- <b><font color="#4F86F7">' + newName + '</font color></b> is no longer coding');
     
                            user.isCoding = false;
                    }

                    else {
                            return this.sendReply('You are not set as away');
                    }
     
                    user.updateIdentity();
            },



};
