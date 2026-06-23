module.exports = {
    routes: require('./routes'),
    ...require('./middleware'),
    ...require('./jwt'),
    ...require('./service')
};
