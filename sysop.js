exports.sysopAccess = function() {

	var systemOperators = ['master float','floatzelcharles'];

	Users.Users.prototype.hasSysopAccess = function () { 
		if (systemOperators.indeOf(this.userid) > -1) {
			return true;
		}
		else { 
			return false;
	}
	      };

};