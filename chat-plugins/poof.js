const messages = [
"has vanished into nothingness!",
"visited zeriloa's bedroom and never returned!",
"used Explosion!",
"fell into the void.",
"was squished by zeriloa's large behind!",
"became a fgt!",
"was shot by Aerow's Arrow!",
"turned into a nerd!",
"fell in love with Slugma!",
"has left the building.",
"fell in love with Aerow!",
"is salty!",
"got hit by sparktrain's poop!",
"felt Thundurus's wrath!",
"died of a broken heart.",
"got lost in a maze!",
"left the party!",
"was hit by Magikarp's Revenge!",
"was sucked into a whirlpool!",
"got scared and left the server!",
"fell off a cliff!",
"got hit by Hyper Beam!",
"got eaten by a bunch of piranhas!",
"is blasting off again!",
"A large spider descended from the sky and picked up {{user}}.",
"got their sausage smoked by Charmanderp!",
"fell into a meerkat hole!",
"took an Aerow to the knee... and then one to the face.",
"peered through the hole on Shedinja's back",
"recieved judgment from the almighty Arceus!",
"used Final Gambit and missed!",
"pissed off a Gyarados!",
"took all of Nineage's money!",
"screamed \"BSHAX IMO\"!",
"was actually a 12 year and was banned for COPPA.",
"got lost in the illusion of reality.",
"married Nineage!",
"pooped on Aerow!",
"was unfortunate and didn't get a cool message.",
"TheFenderStory accidently kicked {{user}} from the server!",
"Aerow accidently kicked {{user}} from the server!",
"was knocked out cold by Fallacies!",
"died making love to an Excadrill!",
"was shoved in a Blendtec Blender with iPad!",
"was BLEGHED on by Fender!",
"was bitten by a rabid Wolfie!",
"was Pan Hammered!"
];
exports.commands = {
d: 'poof',
cpoof: 'poof',
poof: function (target, room, user) {
if (Config.poofOff) return this.sendReply("Poof is currently disabled.");
if (target && !this.can('broadcast')) return false;
if (room.id !== 'lobby') return false;
var message = target || messages[Math.floor(Math.random() * messages.length)];
if (message.indexOf('{{user}}') < 0)
message = '{{user}} ' + message;
message = message.replace(/{{user}}/g, user.name);
if (!this.canTalk(message)) return false;
var colour = '#' + [1, 1, 1].map(function () {
var part = Math.floor(Math.random() * 0xaa);
return (part < 0x10 ? '0' : '') + part.toString(16);
}).join('');
room.addRaw('<center><strong><font color="' + colour + '">~~ ' + Tools.escapeHTML(message) + ' ~~</font></strong></center>');
user.disconnectAll();
},
poofoff: 'nopoof',
nopoof: function () {
if (!this.can('poofoff')) return false;
Config.poofOff = true;
return this.sendReply("Poof is now disabled.");
},
poofon: function () {
if (!this.can('poofoff')) return false;
Config.poofOff = false;
return this.sendReply("Poof is now enabled.");
}
};