module.exports = {
 isLogged : function (req, res, next){
    
    if (req.session.userId) {
        return res.redirect('/')
    }
    return next()
 }
    

}