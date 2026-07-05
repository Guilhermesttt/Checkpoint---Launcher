# Achievement Bridge

O launcher sobe um servidor HTTP local em `127.0.0.1`, tentando a porta `3000` e fazendo fallback ate `3010` se necessario.

## Endpoint

`POST /unlock`

```json
{
  "gameId": "my-game",
  "achievementId": "first-blood"
}
```

## Arquivo de definicoes

Caminho: `userData/achievements/<gameId>.json`

Formato recomendado:

```json
{
  "gameId": "my-game",
  "achievements": [
    {
      "id": "first-blood",
      "name": "Primeiro Abate",
      "description": "Elimine o primeiro inimigo.",
      "icon": "file:///C:/Checkpoint/assets/achievements/first-blood.png"
    }
  ]
}
```

Tambem sao aceitos:

```json
{
  "achievements": {
    "first-blood": {
      "name": "Primeiro Abate",
      "description": "Elimine o primeiro inimigo.",
      "icon": "file:///C:/Checkpoint/assets/achievements/first-blood.png"
    }
  }
}
```

## Progresso salvo

Caminho: `userData/user_progress_<gameId>.json`

As escritas sao serializadas por jogo e persistidas com arquivo temporario + `rename`.

## Unity (C#)

```csharp
using System.Collections;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

public static class AchievementBridgeClient
{
    [System.Serializable]
    private sealed class UnlockPayload
    {
        public string gameId;
        public string achievementId;
    }

    public static IEnumerator Unlock(string gameId, string achievementId)
    {
        var payload = new UnlockPayload
        {
            gameId = gameId,
            achievementId = achievementId
        };

        var json = JsonUtility.ToJson(payload);
        using var request = new UnityWebRequest("http://localhost:3000/unlock", "POST");
        var body = Encoding.UTF8.GetBytes(json);

        request.uploadHandler = new UploadHandlerRaw(body);
        request.downloadHandler = new DownloadHandlerBuffer();
        request.SetRequestHeader("Content-Type", "application/json");

        yield return request.SendWebRequest();

        if (request.result != UnityWebRequest.Result.Success)
        {
            Debug.LogWarning($"Achievement unlock failed: {request.error} | {request.downloadHandler.text}");
        }
    }
}
```

## Unreal Engine (C++)

```cpp
#include "HttpModule.h"
#include "Interfaces/IHttpRequest.h"
#include "Interfaces/IHttpResponse.h"

static void UnlockAchievement(const FString& GameId, const FString& AchievementId)
{
    TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Request =
        FHttpModule::Get().CreateRequest();

    const FString Payload = FString::Printf(
        TEXT("{\"gameId\":\"%s\",\"achievementId\":\"%s\"}"),
        *GameId,
        *AchievementId
    );

    Request->SetURL(TEXT("http://localhost:3000/unlock"));
    Request->SetVerb(TEXT("POST"));
    Request->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
    Request->SetContentAsString(Payload);
    Request->OnProcessRequestComplete().BindLambda(
        [](FHttpRequestPtr, FHttpResponsePtr Response, bool bWasSuccessful)
        {
            if (!bWasSuccessful || !Response.IsValid())
            {
                UE_LOG(LogTemp, Warning, TEXT("Achievement unlock request failed."));
                return;
            }

            UE_LOG(LogTemp, Log, TEXT("Achievement unlock response: %s"), *Response->GetContentAsString());
        }
    );

    Request->ProcessRequest();
}
```
