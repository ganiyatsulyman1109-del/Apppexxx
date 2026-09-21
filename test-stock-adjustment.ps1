$body = @{
    quantity_change = 5
    reason = "Test restock"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3000/api/products/d4704039-1b3a-4def-9d36-2c820d6502d9/stock" -Method PUT -ContentType "application/json" -Body $body -UseBasicParsing