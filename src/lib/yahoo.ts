import YahooFinance from 'yahoo-finance2';

// yahoo-finance2 v3 requires instantiation
const yahooFinance = new (YahooFinance as any)({ 
    suppressNotices: ['yahooSurvey'],
    validation: { logErrors: false } 
});

export default yahooFinance;
