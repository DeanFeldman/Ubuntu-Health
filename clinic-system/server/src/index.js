const app = require('./app')
require('dotenv').config()

const PORT = process.env.PORT || 8080

app.listen(PORT, () => {
  console.log(`Ubuntu Health API running on port ${PORT}`)
})
