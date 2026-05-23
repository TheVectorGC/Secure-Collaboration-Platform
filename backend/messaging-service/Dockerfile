FROM eclipse-temurin:21-jdk AS builder
WORKDIR /workspace
COPY .mvn .mvn
COPY mvnw mvnw
COPY pom.xml pom.xml
RUN chmod +x mvnw
RUN ./mvnw -B dependency:go-offline
COPY src src
RUN ./mvnw -B clean package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
RUN addgroup --system vector && adduser --system --ingroup vector vector
COPY --from=builder /workspace/target/*.jar /app/messaging-service.jar
USER vector
EXPOSE 8087
ENTRYPOINT ["java", "-jar", "/app/messaging-service.jar"]
