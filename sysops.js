	

    //This gives users console access. Don't give it to users unless you trust them completely.
    exports.sysopAccess = function () {
     
      //go ahead and add in a comma separated list of names in the array below.
        var systemOperators = ['Master Float'];
     
        Users.User.prototype.hasSysopAccess = function () {
            if (systemOperators.indexOf(this.userid) > -1) {
                return true;
            } else {
                return false;
            }
                    };
        };

