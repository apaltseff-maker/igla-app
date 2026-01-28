# Использование warehouse_fabrics в коде

## Операции с warehouse_fabrics

### 1. SELECT (чтение списка тканей)
**Файлы:**
- `src/app/api/warehouse/fabrics/list/route.ts` - GET список тканей с остатками
- `src/app/app/cuts/[id]/fabric-usage-client.tsx` - загрузка списка для dropdown

**Операции:**
```sql
SELECT id, name, color, width_cm, density, created_at
FROM warehouse_fabrics
WHERE org_id = ?
ORDER BY name
```

**С join для остатков:**
```sql
SELECT f.*, b.rolls_on_hand, b.meters_on_hand, ...
FROM warehouse_fabrics f
LEFT JOIN warehouse_balances b ON ...
WHERE f.org_id = ?
```

### 2. INSERT (создание ткани)
**Файлы:**
- `src/app/api/warehouse/fabrics/create/route.ts` - POST создание ткани

**Операции:**
```sql
INSERT INTO warehouse_fabrics (org_id, name, color, width_cm, density)
VALUES (?, ?, ?, ?, ?)
```

### 3. SELECT с join (в fabric-usage)
**Файлы:**
- `src/app/api/cuts/fabric-usage/route.ts` - GET список расхода с данными ткани

**Операции:**
```sql
SELECT u.*, f.name, f.color, f.width_cm, f.density
FROM cut_fabric_usage u
JOIN warehouse_fabrics f ON u.fabric_id = f.id
WHERE u.cut_id = ? AND u.org_id = ?
```

### 4. SELECT для проверки существования
**Файлы:**
- `src/app/api/cuts/fabric-usage/route.ts` - POST проверка fabric_id

**Операции:**
```sql
SELECT id, org_id
FROM warehouse_fabrics
WHERE id = ? AND org_id = ?
```

## RLS политики

Все таблицы склада имеют RLS политики:
- SELECT: пользователь видит только записи своей org
- INSERT: пользователь может создавать только в своей org
- UPDATE: пользователь может обновлять только записи своей org
- DELETE: пользователь может удалять только записи своей org

Проверка через:
```sql
org_id IN (SELECT org_id FROM profiles WHERE user_id = auth.uid())
```

## Примечание

Если в будущем будет единая таблица `warehouse_items` с `type`, нужно будет:
1. Заменить все `warehouse_fabrics` на `warehouse_items WHERE type = 'fabric'`
2. Обновить foreign keys в `cut_fabric_usage` и `warehouse_movements`
3. Обновить все API endpoints
